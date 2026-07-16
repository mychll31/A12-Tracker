// Deliberately NOT guarded with `import "server-only"`. The seed script and the
// nightly cron run this module under plain Node, where `server-only` resolves to
// a module that throws. It cannot leak to the browser regardless: it imports the
// Prisma client, which does not resolve in a client bundle.
import { db } from "@/lib/db";
import {
  CONSISTENCY_WEIGHTS,
  GOAL_CATEGORY_KEYS,
  GOAL_CATEGORY_WEIGHTS,
  PLAN_STATUS_WEIGHT,
  SCORE_WEIGHTS,
  SCORING_WINDOW_DAYS,
  STREAK_TARGET_DAYS,
  asActionPlanStatus,
  asGoalCategoryKey,
  asGoalStatus,
  asGoalType,
  type GoalCategoryKey,
} from "@/lib/domain";
import { addDays, dayKey, isoDay, scoringWindow } from "@/lib/dates";

/**
 * The scoring engine.
 *
 * Two things live here, and the split is deliberate:
 *
 *   compute*  — derives scores live from source rows. Always current, never
 *               stale, and what every dashboard and leaderboard reads.
 *   persist*  — freezes today's numbers into the snapshot tables. Snapshots
 *               exist only so trend charts have a yesterday to plot; nothing
 *               reads them for a *current* value.
 *
 * Every score is on 0-100, so a user, a group, a coach and the organization are
 * comparable on one axis without rescaling.
 */

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type CategoryScores = Record<GoalCategoryKey, number>;

export type UserScore = {
  userId: string;
  /** Per-category goal scores: PERSONAL, PROFESSIONAL, CONTRIBUTION. */
  categories: CategoryScores;
  /** The three categories, weighted together. */
  goalScore: number;
  coreTaskScore: number;
  consistencyScore: number;
  overallScore: number;

  currentStreak: number;
  longestStreak: number;

  goalsTotal: number;
  goalsCompleted: number;
  /** Core tasks done ÷ core tasks expected, across the trailing window. */
  taskCompletionRate: number;
  /** Days a check-in was filed ÷ days in the trailing window. */
  checkInRate: number;
};

export type CoachScore = {
  coachId: string;
  averageScore: number;
  menteeCount: number;
  activeCount: number;
};

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------------------
// Goal scoring
// ---------------------------------------------------------------------------

export type ScorableGoal = {
  status: string;
  progress: number;
  categoryKey: string;
  /** MERIT scores by the measure below; MILESTONE scores by its action plans. */
  goalType: string;
  /** The measurable target and how far toward it the owner has come (MERIT). */
  targetValue: number;
  currentValue: number;
  /** Action-plan statuses — the scorer for a MILESTONE goal. */
  tasks: { status: string }[];
};

/**
 * Every goal carries a score on 0-100, and it is its **numeric measure**: how
 * far the current value has come toward the target (`current ÷ target`). Whether
 * the metric is being gained or lost is only a label — a goal is exactly as far
 * along as its number says.
 *
 * Two overrides, and a fallback:
 *   COMPLETED  — always 100. Finishing the goal is finishing it, target or not.
 *   ABANDONED  — null, i.e. withdrawn from the average rather than scored zero.
 *                If dropping a goal you have outgrown permanently damaged your
 *                score, nobody would ever drop one honestly.
 *   no target  — falls back to the goal's own progress field, so a goal without
 *                a measure set still scores rather than reading as zero.
 */
export function scoreGoal(goal: ScorableGoal): number | null {
  const status = asGoalStatus(goal.status);
  if (status === "ABANDONED") return null;
  if (status === "COMPLETED") return 100;

  // A MILESTONE goal is exactly as done as its action plans: the average of
  // their status weights. With no plans yet it falls back to stored progress.
  if (asGoalType(goal.goalType) === "MILESTONE") {
    if (goal.tasks.length === 0) return clamp(goal.progress);
    const sum = goal.tasks.reduce(
      (acc, t) => acc + PLAN_STATUS_WEIGHT[asActionPlanStatus(t.status)],
      0,
    );
    return round(sum / goal.tasks.length);
  }

  // A MERIT goal is its numeric measure: how far current has come toward target.
  if (goal.targetValue > 0) {
    return round(clamp((goal.currentValue / goal.targetValue) * 100));
  }
  return clamp(goal.progress);
}

/**
 * A category's score is the mean of its goals' scores.
 *
 * All three categories are required, so a category holding no goal scores zero.
 * Never setting a contribution goal is itself the gap the score should surface.
 */
export function scoreCategories(goals: ScorableGoal[]): CategoryScores {
  const scores = {} as CategoryScores;

  for (const key of GOAL_CATEGORY_KEYS) {
    const values = goals
      .filter((g) => asGoalCategoryKey(g.categoryKey) === key)
      .map(scoreGoal)
      .filter((v): v is number => v !== null);

    scores[key] = values.length
      ? round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0;
  }

  return scores;
}

/**
 * The Goal Total Score: the three categories combined, on 0-100.
 *
 * Weighted equally, so neglecting your contribution goals cannot be papered over
 * by a strong professional one — which is the entire point of requiring all three.
 */
export function weightGoalScore(categories: CategoryScores): number {
  return round(
    GOAL_CATEGORY_KEYS.reduce(
      (sum, key) => sum + categories[key] * GOAL_CATEGORY_WEIGHTS[key],
      0,
    ),
  );
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/**
 * A day is "kept" when the user showed up at all — completed at least one core
 * task, or filed a check-in.
 *
 * The current streak may end today *or yesterday*. Without that grace every
 * streak in the organization would reset at midnight UTC and climb back only as
 * each person got to their tasks; a streak should not break until a day has
 * actually been missed.
 */
export function computeStreaks(
  keptDays: Set<string>,
  asOf: Date,
): { current: number; longest: number } {
  const end = dayKey(asOf);

  let cursor = keptDays.has(isoDay(end)) ? end : addDays(end, -1);
  let current = 0;
  while (keptDays.has(isoDay(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...keptDays].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of sorted) {
    const isConsecutive =
      previous !== null && isoDay(addDays(new Date(previous), 1)) === day;
    run = isConsecutive ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest: Math.max(longest, current) };
}

// ---------------------------------------------------------------------------
// Batched user scoring
// ---------------------------------------------------------------------------

/** How far back the streak walk looks — long enough that no real streak is clipped. */
const STREAK_HISTORY_DAYS = 400;

/**
 * Scores many users in a fixed number of queries.
 *
 * Leaderboards and the coach dashboard score dozens of people at once; doing
 * that one user at a time would be a query per user per metric. Everything is
 * fetched up front and reduced in memory instead.
 */
export async function computeScoresForUsers(
  userIds: string[],
  asOf: Date = new Date(),
): Promise<Map<string, UserScore>> {
  const result = new Map<string, UserScore>();
  if (userIds.length === 0) return result;

  const end = dayKey(asOf);
  const historyStart = addDays(end, -STREAK_HISTORY_DAYS);

  const [users, goals, completions, checkIns] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, joinedAt: true, organizationId: true },
    }),
    db.goal.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        status: true,
        progress: true,
        goalType: true,
        category: { select: { key: true } },
        // MERIT: the numeric measure. MILESTONE: the action-plan statuses below.
        targetValue: true,
        currentValue: true,
        tasks: { select: { status: true } },
      },
    }),
    db.coreTaskCompletion.findMany({
      where: {
        userId: { in: userIds },
        completed: true,
        date: { gte: historyStart, lte: end },
      },
      select: { userId: true, date: true },
    }),
    db.dailyCheckIn.findMany({
      where: { userId: { in: userIds }, date: { gte: historyStart, lte: end } },
      select: { userId: true, date: true },
    }),
  ]);

  // Core tasks are defined per organization, so the expected daily count can
  // differ between orgs even though everyone inside one org shares it.
  const orgIds = [...new Set(users.map((u) => u.organizationId))];
  const taskCounts = new Map<string, number>();
  await Promise.all(
    orgIds.map(async (orgId) => {
      const count = await db.coreTask.count({
        where: { organizationId: orgId, isActive: true },
      });
      taskCounts.set(orgId, count);
    }),
  );

  // Bucket the raw rows by user once, instead of re-filtering the full arrays
  // inside the per-user loop.
  const goalsBy = new Map<string, ScorableGoal[]>();
  for (const g of goals) {
    const list = goalsBy.get(g.userId) ?? [];
    list.push({
      status: g.status,
      progress: g.progress,
      categoryKey: g.category.key,
      goalType: g.goalType,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      tasks: g.tasks,
    });
    goalsBy.set(g.userId, list);
  }

  const completionsBy = new Map<string, Date[]>();
  for (const c of completions) {
    const list = completionsBy.get(c.userId) ?? [];
    list.push(c.date);
    completionsBy.set(c.userId, list);
  }

  const checkInsBy = new Map<string, Date[]>();
  for (const c of checkIns) {
    const list = checkInsBy.get(c.userId) ?? [];
    list.push(c.date);
    checkInsBy.set(c.userId, list);
  }

  for (const user of users) {
    const userGoals = goalsBy.get(user.id) ?? [];
    const userCompletions = completionsBy.get(user.id) ?? [];
    const userCheckIns = checkInsBy.get(user.id) ?? [];

    // The window never predates the day the user joined, so somebody who
    // arrived on Tuesday is not scored against the whole month.
    const window = scoringWindow(SCORING_WINDOW_DAYS, user.joinedAt, end);
    const activeTasks = taskCounts.get(user.organizationId) ?? 0;

    // --- goals ---
    const categories = scoreCategories(userGoals);
    const goalScore = weightGoalScore(categories);

    // --- core tasks ---
    const inWindow = (d: Date) => d >= window.start && d <= window.end;
    const doneInWindow = userCompletions.filter(inWindow).length;
    const expected = activeTasks * window.days;
    const taskCompletionRate = expected
      ? clamp((doneInWindow / expected) * 100)
      : 0;

    // --- consistency ---
    const checkInsInWindow = userCheckIns.filter(inWindow).length;
    const checkInRate = window.days
      ? clamp((checkInsInWindow / window.days) * 100)
      : 0;

    const keptDays = new Set<string>([
      ...userCompletions.map(isoDay),
      ...userCheckIns.map(isoDay),
    ]);
    const streaks = computeStreaks(keptDays, end);

    const streakScore = clamp(streaks.current / STREAK_TARGET_DAYS, 0, 1) * 100;
    const consistencyScore = round(
      streakScore * CONSISTENCY_WEIGHTS.streak +
        checkInRate * CONSISTENCY_WEIGHTS.checkIns,
    );

    // --- overall ---
    // With the current weights the Goal Total Score carries the whole of this;
    // core tasks and consistency are computed above for display but score 0.
    const overallScore = round(
      goalScore * SCORE_WEIGHTS.goals +
        taskCompletionRate * SCORE_WEIGHTS.coreTasks +
        consistencyScore * SCORE_WEIGHTS.consistency,
    );

    result.set(user.id, {
      userId: user.id,
      categories,
      goalScore,
      coreTaskScore: round(taskCompletionRate),
      consistencyScore,
      overallScore,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      goalsTotal: userGoals.length,
      goalsCompleted: userGoals.filter(
        (g) => asGoalStatus(g.status) === "COMPLETED",
      ).length,
      taskCompletionRate: round(taskCompletionRate),
      checkInRate: round(checkInRate),
    });
  }

  return result;
}

/** Convenience wrapper for the single-user case (a mentee's own dashboard). */
export async function computeUserScore(
  userId: string,
  asOf: Date = new Date(),
): Promise<UserScore> {
  const scores = await computeScoresForUsers([userId], asOf);
  return scores.get(userId) ?? emptyScore(userId);
}

export function emptyScore(userId: string): UserScore {
  return {
    userId,
    categories: { PERSONAL: 0, PROFESSIONAL: 0, CONTRIBUTION: 0 },
    goalScore: 0,
    coreTaskScore: 0,
    consistencyScore: 0,
    overallScore: 0,
    currentStreak: 0,
    longestStreak: 0,
    goalsTotal: 0,
    goalsCompleted: 0,
    taskCompletionRate: 0,
    checkInRate: 0,
  };
}

// ---------------------------------------------------------------------------
// Coach, group and organization scoring
// ---------------------------------------------------------------------------

export function averageScore(scores: UserScore[]): number {
  if (!scores.length) return 0;
  return round(
    scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
  );
}

/**
 * A coach's score *is* the average of their mentees' overall scores — a coach
 * is measured by the people they lift, not by their own task list.
 */
export async function computeCoachScores(
  coachIds: string[],
  asOf: Date = new Date(),
): Promise<Map<string, CoachScore>> {
  const result = new Map<string, CoachScore>();
  if (!coachIds.length) return result;

  const memberships = await db.groupMembership.findMany({
    where: { isActive: true, group: { coachId: { in: coachIds } } },
    select: {
      menteeId: true,
      group: { select: { coachId: true } },
      mentee: { select: { isActive: true } },
    },
  });

  const menteesByCoach = new Map<string, { id: string; isActive: boolean }[]>();
  for (const m of memberships) {
    const list = menteesByCoach.get(m.group.coachId) ?? [];
    list.push({ id: m.menteeId, isActive: m.mentee.isActive });
    menteesByCoach.set(m.group.coachId, list);
  }

  const allMenteeIds = [...new Set(memberships.map((m) => m.menteeId))];
  const menteeScores = await computeScoresForUsers(allMenteeIds, asOf);

  for (const coachId of coachIds) {
    const mentees = menteesByCoach.get(coachId) ?? [];
    const scores = mentees
      .map((m) => menteeScores.get(m.id))
      .filter((s): s is UserScore => Boolean(s));

    result.set(coachId, {
      coachId,
      averageScore: averageScore(scores),
      menteeCount: mentees.length,
      activeCount: mentees.filter((m) => m.isActive).length,
    });
  }

  return result;
}

export async function computeGroupScore(
  groupId: string,
  asOf: Date = new Date(),
): Promise<{ averageScore: number; memberCount: number }> {
  const memberships = await db.groupMembership.findMany({
    where: { groupId, isActive: true },
    select: { menteeId: true },
  });

  const scores = await computeScoresForUsers(
    memberships.map((m) => m.menteeId),
    asOf,
  );

  return {
    averageScore: averageScore([...scores.values()]),
    memberCount: memberships.length,
  };
}

export type OrgScore = {
  averageScore: number;
  memberCount: number;
  activeCount: number;
  goalCompletionRate: number;
  taskCompletionRate: number;
};

export async function computeOrgScore(
  organizationId: string,
  asOf: Date = new Date(),
): Promise<OrgScore> {
  const users = await db.user.findMany({
    where: { organizationId },
    select: { id: true, isActive: true },
  });

  const scores = await computeScoresForUsers(
    users.map((u) => u.id),
    asOf,
  );
  const all = [...scores.values()];

  const goalsTotal = all.reduce((s, u) => s + u.goalsTotal, 0);
  const goalsDone = all.reduce((s, u) => s + u.goalsCompleted, 0);

  return {
    averageScore: averageScore(all),
    memberCount: users.length,
    activeCount: users.filter((u) => u.isActive).length,
    goalCompletionRate: goalsTotal ? round((goalsDone / goalsTotal) * 100) : 0,
    taskCompletionRate: all.length
      ? round(all.reduce((s, u) => s + u.taskCompletionRate, 0) / all.length)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Snapshots — history only
// ---------------------------------------------------------------------------

/**
 * Freeze today's numbers so tomorrow's trend charts have something to plot.
 * Idempotent: re-running for the same day overwrites that day's rows, so the
 * nightly job is safe to retry.
 */
export async function persistSnapshots(
  organizationId: string,
  asOf: Date = new Date(),
): Promise<{ users: number; coaches: number; groups: number }> {
  const date = dayKey(asOf);

  const [users, groups] = await Promise.all([
    db.user.findMany({ where: { organizationId }, select: { id: true } }),
    db.coachGroup.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, coachId: true },
    }),
  ]);

  const scores = await computeScoresForUsers(
    users.map((u) => u.id),
    date,
  );

  for (const [userId, score] of scores) {
    const payload = {
      personalScore: score.categories.PERSONAL,
      professionalScore: score.categories.PROFESSIONAL,
      contributionScore: score.categories.CONTRIBUTION,
      goalScore: score.goalScore,
      coreTaskScore: score.coreTaskScore,
      consistencyScore: score.consistencyScore,
      overallScore: score.overallScore,
      currentStreak: score.currentStreak,
      goalsCompleted: score.goalsCompleted,
    };

    await db.scoreSnapshot.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...payload },
      update: payload,
    });
  }

  const coachIds = [...new Set(groups.map((g) => g.coachId))];
  const coachScores = await computeCoachScores(coachIds, date);

  for (const [coachId, score] of coachScores) {
    const payload = {
      averageScore: score.averageScore,
      menteeCount: score.menteeCount,
      activeCount: score.activeCount,
    };
    await db.coachScoreSnapshot.upsert({
      where: { coachId_date: { coachId, date } },
      create: { coachId, date, ...payload },
      update: payload,
    });
  }

  for (const group of groups) {
    const score = await computeGroupScore(group.id, date);
    const payload = {
      averageScore: score.averageScore,
      memberCount: score.memberCount,
    };
    await db.groupScoreSnapshot.upsert({
      where: { groupId_date: { groupId: group.id, date } },
      create: { groupId: group.id, date, ...payload },
      update: payload,
    });
  }

  const org = await computeOrgScore(organizationId, date);
  await db.orgScoreSnapshot.upsert({
    where: { organizationId_date: { organizationId, date } },
    create: { organizationId, date, ...org },
    update: org,
  });

  return {
    users: scores.size,
    coaches: coachScores.size,
    groups: groups.length,
  };
}

/** Also update the denormalised `user_streaks` row used for fast reads. */
export async function syncStreak(userId: string): Promise<void> {
  const score = await computeUserScore(userId);
  await db.userStreak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: score.currentStreak,
      longestStreak: score.longestStreak,
      lastActiveDay: dayKey(new Date()),
    },
    update: {
      currentStreak: score.currentStreak,
      longestStreak: score.longestStreak,
      lastActiveDay: dayKey(new Date()),
    },
  });
}
