import "server-only";

import type { SessionUser } from "@/lib/auth";
import { addDays, dayKey, daysBetween, isoDay, today } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  OPEN_GOAL_STATUSES,
  asGoalCategoryKey,
  asGoalStatus,
} from "@/lib/domain";
import { ForbiddenError, coachMenteeIds } from "@/lib/rbac";
import {
  computeOrgScore,
  computeScoresForUsers,
  computeUserScore,
  type UserScore,
} from "@/lib/scoring";
import {
  coachComparison,
  orgTrend,
  userScoreTrend,
  type TrendPoint,
} from "@/server/analytics";
import {
  getLeaderboard,
  getUserRank,
  type LeaderboardRow,
} from "@/server/leaderboards";

/**
 * The three landing pages, each assembled in a single pass.
 *
 * A dashboard is the worst place to be lazy about queries — it is the first
 * thing every user loads. The whole mentee cohort is therefore scored *once*
 * with `computeScoresForUsers` and every per-mentee number is read out of that
 * map; calling `computeUserScore` in a loop would issue several queries per
 * mentee and turn a coach with thirty mentees into a hundred round trips.
 */

const round = (n: number) => Math.round(n * 10) / 10;
const percent = (part: number, whole: number) =>
  whole ? round((part / whole) * 100) : 0;

/** A member counts as active if they have shown up within the last week. */
const ACTIVITY_WINDOW_DAYS = 7;
/** Below this overall score a mentee is surfaced to their coach as at risk. */
const AT_RISK_SCORE = 40;

const RECENT_FEEDBACK_LIMIT = 5;
const UPCOMING_DEADLINE_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 15;
const TOP_MEMBER_LIMIT = 10;
const TREND_DAYS = 30;

const monthStart = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

function requirePrivileged(actor: SessionUser): void {
  if (!actor.isCoach && !actor.isAdmin) {
    throw new ForbiddenError("This dashboard is available to coaches only.");
  }
}

function isActiveWithin(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) return false;
  return daysBetween(lastActiveAt, new Date()) <= ACTIVITY_WINDOW_DAYS;
}

// ---------------------------------------------------------------------------
// Mentee
// ---------------------------------------------------------------------------

export async function getMenteeDashboard(actor: SessionUser): Promise<{
  score: UserScore;
  todayTasks: {
    total: number;
    completed: number;
    percent: number;
    items: { id: string; name: string; icon: string; completed: boolean }[];
  };
  hasCheckedInToday: boolean;
  goals: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    byCategory: {
      key: string;
      name: string;
      count: number;
      avgProgress: number;
    }[];
  };
  upcomingDeadlines: {
    id: string;
    title: string;
    targetDate: Date;
    daysUntil: number;
    categoryKey: string;
  }[];
  groupRank: { rank: number; total: number } | null;
  coach: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    headline: string | null;
  } | null;
  recentFeedback: {
    id: string;
    body: string;
    createdAt: Date;
    author: { firstName: string; lastName: string; avatarUrl: string | null };
    goalTitle: string | null;
  }[];
  trend: TrendPoint[];
  achievements: {
    key: string;
    name: string;
    icon: string;
    tier: string;
    unlockedAt: Date;
  }[];
}> {
  const day = today();

  const [
    score,
    tasks,
    completions,
    checkIn,
    goals,
    comments,
    reviews,
    achievements,
    trend,
  ] = await Promise.all([
    computeUserScore(actor.id),
    db.coreTask.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, icon: true },
    }),
    db.coreTaskCompletion.findMany({
      where: { userId: actor.id, date: day, completed: true },
      select: { coreTaskId: true },
    }),
    db.dailyCheckIn.findFirst({
      where: { userId: actor.id, date: day },
      select: { id: true },
    }),
    db.goal.findMany({
      where: { userId: actor.id },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        targetDate: true,
        category: { select: { key: true, name: true } },
      },
    }),
    db.goalComment.findMany({
      where: { goal: { userId: actor.id }, authorId: { not: actor.id } },
      orderBy: { createdAt: "desc" },
      take: RECENT_FEEDBACK_LIMIT,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
        goal: { select: { title: true } },
      },
    }),
    db.checkInReview.findMany({
      where: { checkIn: { userId: actor.id } },
      orderBy: { createdAt: "desc" },
      take: RECENT_FEEDBACK_LIMIT,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        coach: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    db.userAchievement.findMany({
      where: { userId: actor.id },
      orderBy: { unlockedAt: "desc" },
      select: {
        unlockedAt: true,
        achievement: {
          select: { key: true, name: true, icon: true, tier: true },
        },
      },
    }),
    userScoreTrend(actor, actor.id, TREND_DAYS),
  ]);

  const done = new Set(completions.map((c) => c.coreTaskId));

  const openGoals = goals.filter((g) =>
    OPEN_GOAL_STATUSES.includes(asGoalStatus(g.status)),
  );

  const categoryTotals = new Map<
    string,
    { key: string; name: string; count: number; progressSum: number }
  >();

  for (const goal of goals) {
    const key = asGoalCategoryKey(goal.category.key);
    const entry = categoryTotals.get(key) ?? {
      key,
      name: goal.category.name,
      count: 0,
      progressSum: 0,
    };
    entry.count += 1;
    entry.progressSum += goal.progress;
    categoryTotals.set(key, entry);
  }

  const byCategory = [...categoryTotals.values()].map(
    ({ key, name, count, progressSum }) => ({
      key,
      name,
      count,
      avgProgress: count ? round(progressSum / count) : 0,
    }),
  );

  // Coach and rank both hang off the mentee's group: without one there is no
  // coach to show and no board to be ranked on.
  const [group, groupRank] = await Promise.all([
    actor.menteeGroupId
      ? db.coachGroup.findFirst({
          where: {
            id: actor.menteeGroupId,
            organizationId: actor.organizationId,
            isActive: true,
            coach: { isActive: true },
          },
          select: {
            coach: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                headline: true,
              },
            },
          },
        })
      : null,
    actor.menteeGroupId
      ? getUserRank(actor, actor.id, "GROUP", actor.menteeGroupId)
      : null,
  ]);

  const recentFeedback = [
    ...comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.author,
      goalTitle: c.goal.title as string | null,
    })),
    ...reviews.map((r) => ({
      id: r.id,
      body: r.comment,
      createdAt: r.createdAt,
      author: r.coach,
      goalTitle: null as string | null,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RECENT_FEEDBACK_LIMIT);

  return {
    score,
    todayTasks: {
      total: tasks.length,
      completed: done.size,
      percent: percent(done.size, tasks.length),
      items: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        icon: t.icon,
        completed: done.has(t.id),
      })),
    },
    hasCheckedInToday: Boolean(checkIn),
    goals: {
      total: goals.length,
      completed: goals.filter((g) => asGoalStatus(g.status) === "COMPLETED")
        .length,
      inProgress: goals.filter((g) => asGoalStatus(g.status) === "IN_PROGRESS")
        .length,
      overdue: openGoals.filter((g) => dayKey(g.targetDate) < day).length,
      byCategory,
    },
    // Overdue goals belong here, first. Filtering them out would hide exactly
    // the deadlines a mentee most needs to act on — an overdue goal does not
    // stop being a deadline, it becomes the urgent one. `daysUntil` goes
    // negative for those, which is how the page flags them.
    upcomingDeadlines: openGoals
      .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime())
      .slice(0, UPCOMING_DEADLINE_LIMIT)
      .map((g) => ({
        id: g.id,
        title: g.title,
        targetDate: g.targetDate,
        daysUntil: daysBetween(day, g.targetDate),
        categoryKey: asGoalCategoryKey(g.category.key),
      })),
    groupRank,
    coach: group?.coach ?? null,
    recentFeedback,
    trend,
    achievements: achievements.map((a) => ({
      key: a.achievement.key,
      name: a.achievement.name,
      icon: a.achievement.icon,
      tier: a.achievement.tier,
      unlockedAt: a.unlockedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

export async function getCoachDashboard(actor: SessionUser): Promise<{
  totals: {
    mentees: number;
    activeMentees: number;
    groups: number;
    avgGroupScore: number;
    goalCompletionRate: number;
    coreTaskCompletion: number;
    checkInsThisWeek: number;
    pendingReviews: number;
    notesThisMonth: number;
  };
  groups: {
    id: string;
    name: string;
    memberCount: number;
    averageScore: number;
  }[];
  mentees: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    headline: string | null;
    groupName: string | null;
    overallScore: number;
    currentStreak: number;
    goalsCompleted: number;
    goalsTotal: number;
    taskCompletionRate: number;
    lastActiveAt: Date | null;
    isAtRisk: boolean;
  }[];
  coachRank: { rank: number; total: number } | null;
  followUps: {
    id: string;
    title: string;
    menteeId: string;
    menteeName: string;
    followUpDate: Date;
  }[];
  recentActivity: {
    id: string;
    summary: string;
    createdAt: Date;
    type: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }[];
  trend: { date: string; averageScore: number }[];
}> {
  requirePrivileged(actor);

  const day = today();
  const weekAgo = addDays(day, -(ACTIVITY_WINDOW_DAYS - 1));

  const menteeIds = await coachMenteeIds(actor.id);

  const [
    groups,
    menteeRows,
    scores,
    checkInsThisWeek,
    pendingReviews,
    notesThisMonth,
    followUpRows,
    recentActivity,
    trendRows,
    coachRank,
  ] = await Promise.all([
    db.coachGroup.findMany({
      where: { coachId: actor.id, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        memberships: {
          where: { isActive: true, mentee: { isActive: true } },
          select: { menteeId: true },
        },
      },
    }),
    db.user.findMany({
      where: { id: { in: menteeIds }, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        headline: true,
        lastActiveAt: true,
        memberships: {
          where: {
            isActive: true,
            group: { isActive: true, coach: { isActive: true } },
          },
          select: { group: { select: { name: true } } },
        },
      },
    }),
    // Scored once for the whole cohort — see the note at the top of the file.
    computeScoresForUsers(menteeIds),
    db.dailyCheckIn.count({
      where: { userId: { in: menteeIds }, date: { gte: weekAgo } },
    }),
    // A check-in nobody has reviewed is the coach's queue.
    db.dailyCheckIn.count({
      where: { userId: { in: menteeIds }, reviews: { none: {} } },
    }),
    db.coachingNote.count({
      where: {
        coachId: actor.id,
        createdAt: { gte: monthStart() },
        mentee: { isActive: true },
      },
    }),
    db.coachingNote.findMany({
      where: {
        coachId: actor.id,
        followUpDate: { gte: day },
        mentee: { isActive: true },
      },
      orderBy: { followUpDate: "asc" },
      select: {
        id: true,
        title: true,
        menteeId: true,
        followUpDate: true,
        mentee: { select: { firstName: true, lastName: true } },
      },
    }),
    db.activityLog.findMany({
      where: { userId: { in: menteeIds }, user: { isActive: true } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        summary: true,
        createdAt: true,
        type: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    }),
    db.coachScoreSnapshot.findMany({
      where: {
        coachId: actor.id,
        date: { gte: addDays(day, -(TREND_DAYS - 1)) },
      },
      orderBy: { date: "asc" },
      select: { date: true, averageScore: true },
    }),
    getUserRank(actor, actor.id, "COACH", actor.organizationId),
  ]);

  const all = [...scores.values()];

  const mentees = menteeRows.map((m) => {
    const score = scores.get(m.id);
    const overallScore = score?.overallScore ?? 0;

    return {
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      avatarUrl: m.avatarUrl,
      headline: m.headline,
      groupName: m.memberships[0]?.group.name ?? null,
      overallScore,
      currentStreak: score?.currentStreak ?? 0,
      goalsCompleted: score?.goalsCompleted ?? 0,
      goalsTotal: score?.goalsTotal ?? 0,
      taskCompletionRate: score?.taskCompletionRate ?? 0,
      lastActiveAt: m.lastActiveAt,
      isAtRisk:
        overallScore < AT_RISK_SCORE || !isActiveWithin(m.lastActiveAt),
    };
  });

  const groupSummaries = groups.map((g) => {
    const memberScores = g.memberships
      .map((m) => scores.get(m.menteeId))
      .filter((s): s is UserScore => Boolean(s));

    return {
      id: g.id,
      name: g.name,
      memberCount: g.memberships.length,
      averageScore: memberScores.length
        ? round(
            memberScores.reduce((s, m) => s + m.overallScore, 0) /
              memberScores.length,
          )
        : 0,
    };
  });

  const goalsTotal = all.reduce((s, u) => s + u.goalsTotal, 0);
  const goalsDone = all.reduce((s, u) => s + u.goalsCompleted, 0);

  return {
    totals: {
      mentees: menteeIds.length,
      activeMentees: mentees.filter((m) => isActiveWithin(m.lastActiveAt))
        .length,
      groups: groups.length,
      avgGroupScore: groupSummaries.length
        ? round(
            groupSummaries.reduce((s, g) => s + g.averageScore, 0) /
              groupSummaries.length,
          )
        : 0,
      goalCompletionRate: percent(goalsDone, goalsTotal),
      coreTaskCompletion: all.length
        ? round(all.reduce((s, u) => s + u.taskCompletionRate, 0) / all.length)
        : 0,
      checkInsThisWeek,
      pendingReviews,
      notesThisMonth,
    },
    groups: groupSummaries,
    mentees,
    coachRank,
    followUps: followUpRows.flatMap((n) =>
      // The `gte` filter above already guarantees a date; the schema's optional
      // column is what TypeScript sees, so the null is narrowed away here.
      n.followUpDate
        ? [
            {
              id: n.id,
              title: n.title,
              menteeId: n.menteeId,
              menteeName: `${n.mentee.firstName} ${n.mentee.lastName}`,
              followUpDate: n.followUpDate,
            },
          ]
        : [],
    ),
    recentActivity,
    trend: trendRows.map((r) => ({
      date: isoDay(r.date),
      averageScore: r.averageScore,
    })),
  };
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export async function getOrgDashboard(actor: SessionUser): Promise<{
  totals: {
    coaches: number;
    mentees: number;
    activeMembers: number;
    totalMembers: number;
    orgScore: number;
    goalCompletionRate: number;
    taskCompletionRate: number;
  };
  coaches: Awaited<ReturnType<typeof coachComparison>>;
  topMembers: LeaderboardRow[];
  trend: Awaited<ReturnType<typeof orgTrend>>;
  growth: {
    newMembersThisMonth: number;
    goalsCompletedThisMonth: number;
    checkInsThisMonth: number;
  };
}> {
  requirePrivileged(actor);

  const orgId = actor.organizationId;
  const since = monthStart();

  const [
    org,
    coachCount,
    menteeCount,
    coaches,
    board,
    trend,
    newMembersThisMonth,
    goalsCompletedThisMonth,
    checkInsThisMonth,
  ] = await Promise.all([
    computeOrgScore(orgId),
    db.user.count({
      where: {
        organizationId: orgId,
        isActive: true,
        roles: { some: { role: { key: "COACH" } } },
      },
    }),
    db.user.count({
      where: {
        organizationId: orgId,
        isActive: true,
        roles: { some: { role: { key: "MENTEE" } } },
      },
    }),
    coachComparison(actor, orgId),
    getLeaderboard(actor, "ORGANIZATION", orgId),
    orgTrend(actor, orgId, TREND_DAYS),
    db.user.count({
      where: {
        organizationId: orgId,
        isActive: true,
        joinedAt: { gte: since },
      },
    }),
    db.goal.count({
      where: {
        user: { organizationId: orgId, isActive: true },
        status: "COMPLETED",
        completedAt: { gte: since },
      },
    }),
    db.dailyCheckIn.count({
      where: {
        user: { organizationId: orgId, isActive: true },
        date: { gte: since },
      },
    }),
  ]);

  return {
    totals: {
      coaches: coachCount,
      mentees: menteeCount,
      activeMembers: org.activeCount,
      totalMembers: org.memberCount,
      orgScore: org.averageScore,
      goalCompletionRate: org.goalCompletionRate,
      taskCompletionRate: org.taskCompletionRate,
    },
    coaches,
    topMembers: board.slice(0, TOP_MEMBER_LIMIT),
    trend,
    growth: {
      newMembersThisMonth,
      goalsCompletedThisMonth,
      checkInsThisMonth,
    },
  };
}
