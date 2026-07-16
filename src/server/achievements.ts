import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { assertCanViewUser } from "@/lib/rbac";
import { computeUserScore, type UserScore } from "@/lib/scoring";
import { ACHIEVEMENT_DEFS, type AchievementDef } from "@/lib/achievement-defs";

/**
 * Achievements.
 *
 * The definitions themselves are pure data and live in `@/lib/achievement-defs`
 * so the seed script can read them without pulling in the server runtime. They
 * are re-exported here as the single import surface for server callers.
 *
 * Everything an achievement can test is already derived by the scoring engine,
 * so a criterion is a threshold against one `UserScore` field rather than its
 * own query. Adding a badge is a data change, never a code change.
 */

export type { AchievementDef };
export { ACHIEVEMENT_DEFS };

export type AchievementStatus = {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  unlockedAt: Date | null;
};

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

/** The `UserScore` fields a criterion may threshold against. */
const METRICS = [
  "streak",
  "goalsCompleted",
  "overallScore",
  "taskCompletionRate",
  "checkInRate",
] as const;

type Metric = (typeof METRICS)[number];

type Criteria = { metric: Metric; gte: number };

function metricValue(metric: Metric, score: UserScore): number {
  switch (metric) {
    case "streak":
      return score.currentStreak;
    case "goalsCompleted":
      return score.goalsCompleted;
    case "overallScore":
      return score.overallScore;
    case "taskCompletionRate":
      return score.taskCompletionRate;
    case "checkInRate":
      return score.checkInRate;
  }
}

/**
 * Criteria arrive as a TEXT column, so a malformed or unknown rule must fail
 * closed — an unreadable badge stays locked rather than unlocking for everybody.
 */
function parseCriteria(raw: string): Criteria | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const { metric, gte } = parsed as { metric?: unknown; gte?: unknown };
  if (typeof metric !== "string" || typeof gte !== "number") return null;
  if (!(METRICS as readonly string[]).includes(metric)) return null;

  return { metric: metric as Metric, gte };
}

export function meetsCriteria(criteria: string, score: UserScore): boolean {
  const rule = parseCriteria(criteria);
  if (!rule) return false;
  return metricValue(rule.metric, score) >= rule.gte;
}

// ---------------------------------------------------------------------------
// Definition rows
// ---------------------------------------------------------------------------

/**
 * `UserAchievement` needs an `achievementId`, so a definition must exist as a
 * row before it can be unlocked. The seed inserts them; this back-fills any
 * definition added since the last seed run. Existing rows are never rewritten —
 * the database stays the source of truth for anything already seeded.
 */
async function achievementIdsByKey(): Promise<Map<string, string>> {
  const keys = ACHIEVEMENT_DEFS.map((d) => d.key);

  const existing = await db.achievement.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });

  const byKey = new Map(existing.map((row) => [row.key, row.id]));

  for (const def of ACHIEVEMENT_DEFS) {
    if (byKey.has(def.key)) continue;
    const row = await db.achievement.create({
      data: {
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        tier: def.tier,
        criteria: def.criteria,
      },
      select: { id: true, key: true },
    });
    byKey.set(row.key, row.id);
  }

  return byKey;
}

// ---------------------------------------------------------------------------
// Unlocking
// ---------------------------------------------------------------------------

/**
 * Returns only the achievements unlocked by *this* call, so the caller can
 * announce them exactly once. Re-running is safe: the unique
 * [userId, achievementId] pair means an already-held badge is neither
 * re-inserted nor re-returned.
 */
export async function checkAchievements(
  userId: string,
): Promise<AchievementDef[]> {
  const [score, idsByKey, held] = await Promise.all([
    computeUserScore(userId),
    achievementIdsByKey(),
    db.userAchievement.findMany({
      where: { userId },
      select: { achievement: { select: { key: true } } },
    }),
  ]);

  const heldKeys = new Set(held.map((row) => row.achievement.key));

  const earned = ACHIEVEMENT_DEFS.filter(
    (def) => !heldKeys.has(def.key) && meetsCriteria(def.criteria, score),
  );

  const unlocked: AchievementDef[] = [];

  for (const def of earned) {
    const achievementId = idsByKey.get(def.key);
    if (!achievementId) continue;

    // Upsert, not create: two sweeps racing must not throw on the unique
    // constraint, and an empty `update` preserves the original unlockedAt.
    await db.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId } },
      create: { userId, achievementId },
      update: {},
    });

    unlocked.push(def);
  }

  return unlocked;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Every definition, locked ones included — a badge you cannot see is no goal. */
export async function listAchievements(
  actor: SessionUser,
  userId: string,
): Promise<AchievementStatus[]> {
  await assertCanViewUser(actor, userId);

  const rows = await db.userAchievement.findMany({
    where: { userId },
    select: { unlockedAt: true, achievement: { select: { key: true } } },
  });

  const unlockedAt = new Map(
    rows.map((row) => [row.achievement.key, row.unlockedAt]),
  );

  return ACHIEVEMENT_DEFS.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    icon: def.icon,
    tier: def.tier,
    unlockedAt: unlockedAt.get(def.key) ?? null,
  }));
}
