import "server-only";

import type { SessionUser } from "@/lib/auth";
import { addDays, dayKey, isoDay, lastNDays, today } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  GOAL_CATEGORY_KEYS,
  asGoalCategoryKey,
  asGoalStatus,
  type GoalCategoryKey,
} from "@/lib/domain";
import {
  ForbiddenError,
  assertCanViewGroup,
  assertCanViewUser,
} from "@/lib/rbac";
import { computeCoachScores, computeUserScore } from "@/lib/scoring";

/**
 * Every chart in Abundance Hub.
 *
 * History is read from the snapshot tables — that is the entire reason they
 * exist. Re-deriving what a score *was* on a Tuesday would mean replaying that
 * day's goals, tasks and check-ins for every day on the axis, and the answer
 * would still drift as source rows are edited after the fact. A snapshot is the
 * record of what the number actually was. Current values come from scoring.ts.
 */

export type TrendPoint = {
  date: string;
  overall: number;
  goal: number;
  coreTask: number;
  consistency: number;
};

const round = (n: number) => Math.round(n * 10) / 10;

/** Inclusive lower bound of an N-day window ending today. */
const windowStart = (days: number): Date => addDays(today(), -(days - 1));

function requireCoach(actor: SessionUser): void {
  if (!actor.isCoach && !actor.isAdmin) {
    throw new ForbiddenError(
      "Organization-wide analytics are visible to coaches only.",
    );
  }
}

/** Coaches and admins read across their own organization, and no other. */
function requireOrg(actor: SessionUser, organizationId: string): void {
  requireCoach(actor);
  if (actor.organizationId !== organizationId) {
    throw new ForbiddenError("That organization is not visible to you.");
  }
}

// ---------------------------------------------------------------------------
// Score History
// ---------------------------------------------------------------------------

export async function userScoreTrend(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<TrendPoint[]> {
  await assertCanViewUser(actor, userId);

  const rows = await db.scoreSnapshot.findMany({
    where: { userId, date: { gte: windowStart(days) } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      overallScore: true,
      goalScore: true,
      coreTaskScore: true,
      consistencyScore: true,
    },
  });

  return rows.map((r) => ({
    date: isoDay(r.date),
    overall: r.overallScore,
    goal: r.goalScore,
    coreTask: r.coreTaskScore,
    consistency: r.consistencyScore,
  }));
}

// ---------------------------------------------------------------------------
// Task Completion
// ---------------------------------------------------------------------------

export async function userTaskTrend(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<
  { date: string; percent: number; completed: number; total: number }[]
> {
  await assertCanViewUser(actor, userId);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user) return [];

  const [total, completions] = await Promise.all([
    db.coreTask.count({
      where: { organizationId: user.organizationId, isActive: true },
    }),
    db.coreTaskCompletion.findMany({
      where: { userId, completed: true, date: { gte: windowStart(days) } },
      select: { date: true },
    }),
  ]);

  const doneOn = new Map<string, number>();
  for (const c of completions) {
    const key = isoDay(c.date);
    doneOn.set(key, (doneOn.get(key) ?? 0) + 1);
  }

  // Every day in the window is emitted, including the empty ones: a missed day
  // is a zero on the chart, and the absence of a row is what "missed" means.
  return lastNDays(days).map((day) => {
    const completed = doneOn.get(isoDay(day)) ?? 0;
    return {
      date: isoDay(day),
      percent: total ? round((completed / total) * 100) : 0,
      completed,
      total,
    };
  });
}

// ---------------------------------------------------------------------------
// Streak History
// ---------------------------------------------------------------------------

/** Kept = showed up at all: a core task done, or a check-in filed — scoring.ts's rule. */
export async function userStreakHistory(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<{ date: string; kept: boolean }[]> {
  await assertCanViewUser(actor, userId);

  const start = windowStart(days);

  const [completions, checkIns] = await Promise.all([
    db.coreTaskCompletion.findMany({
      where: { userId, completed: true, date: { gte: start } },
      select: { date: true },
    }),
    db.dailyCheckIn.findMany({
      where: { userId, date: { gte: start } },
      select: { date: true },
    }),
  ]);

  const kept = new Set<string>([
    ...completions.map((c) => isoDay(c.date)),
    ...checkIns.map((c) => isoDay(c.date)),
  ]);

  return lastNDays(days).map((day) => ({
    date: isoDay(day),
    kept: kept.has(isoDay(day)),
  }));
}

// ---------------------------------------------------------------------------
// Goal Progress
// ---------------------------------------------------------------------------

export async function categoryBreakdown(
  actor: SessionUser,
  userId: string,
): Promise<
  {
    key: GoalCategoryKey;
    name: string;
    score: number;
    total: number;
    completed: number;
    avgProgress: number;
  }[]
> {
  await assertCanViewUser(actor, userId);

  const [categories, goals, score] = await Promise.all([
    db.goalCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { key: true, name: true },
    }),
    db.goal.findMany({
      where: { userId },
      select: {
        status: true,
        progress: true,
        category: { select: { key: true } },
      },
    }),
    computeUserScore(userId),
  ]);

  const named = new Map(categories.map((c) => [c.key, c.name]));

  // Driven off the canonical key list rather than the rows: a category the user
  // has never set a goal in still has to appear — the empty column is the point.
  return GOAL_CATEGORY_KEYS.map((key) => {
    const mine = goals.filter((g) => asGoalCategoryKey(g.category.key) === key);
    const completed = mine.filter(
      (g) => asGoalStatus(g.status) === "COMPLETED",
    ).length;

    return {
      key,
      name: named.get(key) ?? key,
      score: score.categories[key],
      total: mine.length,
      completed,
      avgProgress: mine.length
        ? round(mine.reduce((s, g) => s + g.progress, 0) / mine.length)
        : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Mood
// ---------------------------------------------------------------------------

export async function moodTrend(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<{ date: string; mood: number | null }[]> {
  await assertCanViewUser(actor, userId);

  const checkIns = await db.dailyCheckIn.findMany({
    where: { userId, date: { gte: windowStart(days) } },
    select: { date: true, mood: true },
  });

  const moods = new Map(checkIns.map((c) => [isoDay(c.date), c.mood]));

  // `null` on a day with no check-in, never 0 — an unreported mood is unknown,
  // and plotting it as zero would invent a terrible day nobody had.
  return lastNDays(days).map((day) => ({
    date: isoDay(day),
    mood: moods.get(isoDay(day)) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Group Performance
// ---------------------------------------------------------------------------

export async function groupTrend(
  actor: SessionUser,
  groupId: string,
  days: number,
): Promise<{ date: string; averageScore: number; memberCount: number }[]> {
  assertCanViewGroup(actor, groupId);

  const rows = await db.groupScoreSnapshot.findMany({
    where: { groupId, date: { gte: windowStart(days) } },
    orderBy: { date: "asc" },
    select: { date: true, averageScore: true, memberCount: true },
  });

  return rows.map((r) => ({
    date: isoDay(r.date),
    averageScore: r.averageScore,
    memberCount: r.memberCount,
  }));
}

// ---------------------------------------------------------------------------
// Organization Growth
// ---------------------------------------------------------------------------

export async function orgTrend(
  actor: SessionUser,
  organizationId: string,
  days: number,
): Promise<
  {
    date: string;
    averageScore: number;
    goalCompletionRate: number;
    taskCompletionRate: number;
    activeCount: number;
  }[]
> {
  requireOrg(actor, organizationId);

  const rows = await db.orgScoreSnapshot.findMany({
    where: { organizationId, date: { gte: windowStart(days) } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      averageScore: true,
      goalCompletionRate: true,
      taskCompletionRate: true,
      activeCount: true,
    },
  });

  return rows.map((r) => ({
    date: isoDay(r.date),
    averageScore: r.averageScore,
    goalCompletionRate: r.goalCompletionRate,
    taskCompletionRate: r.taskCompletionRate,
    activeCount: r.activeCount,
  }));
}

// ---------------------------------------------------------------------------
// Coach Performance
// ---------------------------------------------------------------------------

export async function coachComparison(
  actor: SessionUser,
  organizationId: string,
): Promise<
  {
    coach: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    averageScore: number;
    menteeCount: number;
    activeCount: number;
    groupNames: string[];
  }[]
> {
  requireOrg(actor, organizationId);

  const coaches = await db.user.findMany({
    where: {
      organizationId,
      roles: { some: { role: { key: "COACH" } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      coachGroups: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { name: true },
      },
    },
  });

  const scores = await computeCoachScores(coaches.map((c) => c.id));

  return coaches
    .map((c) => {
      const score = scores.get(c.id);
      return {
        coach: {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          avatarUrl: c.avatarUrl,
        },
        averageScore: score?.averageScore ?? 0,
        menteeCount: score?.menteeCount ?? 0,
        activeCount: score?.activeCount ?? 0,
        groupNames: c.coachGroups.map((g) => g.name),
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

// ---------------------------------------------------------------------------
// Weekly / Monthly Trends
// ---------------------------------------------------------------------------

/** Monday of the week a day falls in. Weeks are labelled by their start date. */
function weekStart(date: Date): Date {
  const day = dayKey(date);
  const dow = day.getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export async function weeklyRollup(
  actor: SessionUser,
  userId: string,
  weeks: number,
): Promise<
  { week: string; avgScore: number; tasksCompleted: number; checkIns: number }[]
> {
  await assertCanViewUser(actor, userId);

  const firstWeek = addDays(weekStart(today()), -(weeks - 1) * 7);

  const [snapshots, completions, checkIns] = await Promise.all([
    db.scoreSnapshot.findMany({
      where: { userId, date: { gte: firstWeek } },
      select: { date: true, overallScore: true },
    }),
    db.coreTaskCompletion.findMany({
      where: { userId, completed: true, date: { gte: firstWeek } },
      select: { date: true },
    }),
    db.dailyCheckIn.findMany({
      where: { userId, date: { gte: firstWeek } },
      select: { date: true },
    }),
  ]);

  // Seeded with every week in the range first, so a silent week plots as a
  // trough instead of vanishing from the axis.
  const buckets = new Map<
    string,
    { scores: number[]; tasks: number; checkIns: number }
  >();

  for (let i = 0; i < weeks; i += 1) {
    buckets.set(isoDay(addDays(firstWeek, i * 7)), {
      scores: [],
      tasks: 0,
      checkIns: 0,
    });
  }

  for (const s of snapshots) {
    buckets.get(isoDay(weekStart(s.date)))?.scores.push(s.overallScore);
  }
  for (const c of completions) {
    const bucket = buckets.get(isoDay(weekStart(c.date)));
    if (bucket) bucket.tasks += 1;
  }
  for (const c of checkIns) {
    const bucket = buckets.get(isoDay(weekStart(c.date)));
    if (bucket) bucket.checkIns += 1;
  }

  return [...buckets.entries()].map(([week, bucket]) => ({
    week,
    avgScore: bucket.scores.length
      ? round(bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length)
      : 0,
    tasksCompleted: bucket.tasks,
    checkIns: bucket.checkIns,
  }));
}
