/**
 * End-to-end sanity check against the seeded database.
 *
 * Exercises the real engine — scoring, roles, leaderboards — rather than
 * re-querying tables, so a broken rule fails loudly here instead of quietly
 * misreporting on a page. Run with: npx tsx scripts/verify.ts
 */
// tsx does not read .env on its own; `prisma db seed` only gets it via
// prisma.config.ts. Without this the client cannot find DATABASE_URL.
import "dotenv/config";

import { db } from "../src/lib/db";
import {
  computeCoachScores,
  computeOrgScore,
  computeUserScore,
  scoreCategories,
  scoreGoal,
  weightGoalScore,
} from "../src/lib/scoring";

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

async function main() {
  console.log("\nAbundance Hub — verification\n");

  // --- the dual-role invariant ---------------------------------------------
  const maychell = await db.user.findUnique({
    where: { email: "maychell@abundancehub.io" },
    include: {
      roles: { include: { role: true } },
      memberships: { where: { isActive: true }, include: { group: true } },
      coachGroups: true,
    },
  });

  const roles = maychell?.roles.map((r) => r.role.key) ?? [];
  check(
    "Maychell holds COACH and MENTEE on one account",
    roles.includes("COACH") && roles.includes("MENTEE"),
    roles.join("+"),
  );
  check(
    "Maychell coaches exactly one group",
    maychell?.coachGroups.length === 1,
    maychell?.coachGroups[0]?.name,
  );
  check(
    "Maychell is mentored in another coach's group",
    maychell?.memberships.length === 1 &&
      maychell.memberships[0].group.coachId !== maychell.id,
    maychell?.memberships[0]?.group.name,
  );

  // --- one mentee, one group -----------------------------------------------
  const memberships = await db.groupMembership.groupBy({
    by: ["menteeId"],
    where: { isActive: true },
    _count: { menteeId: true },
  });
  check(
    "every mentee has exactly one active group",
    memberships.every((m) => m._count.menteeId === 1),
    `${memberships.length} mentees`,
  );

  // --- goals: all three categories are required ----------------------------
  const mentees = await db.user.findMany({
    where: { roles: { some: { role: { key: "MENTEE" } } } },
    select: { id: true, firstName: true },
  });

  const categories = await db.goalCategory.count();
  check("three goal categories exist", categories === 3);

  let allThree = true;
  for (const m of mentees) {
    const goals = await db.goal.findMany({
      where: { userId: m.id },
      select: { category: { select: { key: true } } },
    });
    if (new Set(goals.map((g) => g.category.key)).size < 3) allThree = false;
  }
  check(
    "every mentee carries a goal in all 3 categories",
    allThree,
    `${mentees.length} mentees`,
  );

  // --- every goal carries a to-do list, and is scored from it ---------------
  const goalsWithoutTasks = await db.goal.count({ where: { tasks: { none: {} } } });
  check(
    "every goal has a task list",
    goalsWithoutTasks === 0,
    `${await db.goalTask.count()} tasks across ${await db.goal.count()} goals`,
  );

  const allGoals = await db.goal.findMany({
    include: { tasks: true, category: { select: { key: true } } },
  });

  const misscored = allGoals.filter((g) => {
    if (g.status === "COMPLETED" || g.status === "ABANDONED") return false;
    const total = g.tasks.reduce((s, t) => s + Math.max(1, t.weight), 0);
    const done = g.tasks
      .filter((t) => t.isComplete)
      .reduce((s, t) => s + Math.max(1, t.weight), 0);
    const expected = total ? Math.round((done / total) * 100) : 0;
    const actual = scoreGoal({
      status: g.status,
      progress: g.progress,
      categoryKey: g.category.key,
      tasks: g.tasks,
    });
    return actual === null || Math.abs(actual - expected) > 0.5;
  });
  check(
    "each goal's score is the weighted share of its tasks done",
    misscored.length === 0,
    `${allGoals.length} goals checked`,
  );

  // --- the Goal Total Score is the three categories combined ----------------
  for (const m of mentees.slice(0, 3)) {
    const goals = allGoals
      .filter((g) => g.userId === m.id)
      .map((g) => ({
        status: g.status,
        progress: g.progress,
        categoryKey: g.category.key,
        tasks: g.tasks,
      }));
    const cats = scoreCategories(goals);
    const total = weightGoalScore(cats);
    const score = await computeUserScore(m.id);
    check(
      `${m.firstName}'s Goal Total Score = the 3 categories combined`,
      Math.abs(score.goalScore - total) < 0.15,
      `P${cats.PERSONAL}/Pr${cats.PROFESSIONAL}/C${cats.CONTRIBUTION} -> ${total}`,
    );
  }

  // --- scoring engine -------------------------------------------------------
  const scores = await Promise.all(
    mentees.map(async (m) => ({
      name: m.firstName,
      score: await computeUserScore(m.id),
    })),
  );

  check(
    "all overall scores land in 0-100",
    scores.every((s) => s.score.overallScore >= 0 && s.score.overallScore <= 100),
  );

  const overalls = scores.map((s) => s.score.overallScore);
  const spread = Math.max(...overalls) - Math.min(...overalls);
  check(
    "mentee scores are differentiated",
    spread > 20,
    `spread ${spread.toFixed(1)} (${Math.min(...overalls)}–${Math.max(...overalls)})`,
  );

  const streaks = scores.map((s) => s.score.currentStreak);
  check(
    "streaks vary across mentees",
    new Set(streaks).size > 1,
    `longest current ${Math.max(...streaks)}d`,
  );

  // --- a coach's score IS their mentees' average ----------------------------
  const coaches = await db.user.findMany({
    where: { coachGroups: { some: {} } },
    select: { id: true, firstName: true },
  });
  const coachScores = await computeCoachScores(coaches.map((c) => c.id));

  for (const c of coaches) {
    const cs = coachScores.get(c.id);
    if (!cs) continue;

    const theirMentees = await db.groupMembership.findMany({
      where: { isActive: true, group: { coachId: c.id } },
      select: { menteeId: true },
    });
    const theirScores = await Promise.all(
      theirMentees.map((m) => computeUserScore(m.menteeId)),
    );
    const expected = theirScores.length
      ? theirScores.reduce((s, x) => s + x.overallScore, 0) / theirScores.length
      : 0;

    check(
      `coach ${c.firstName}'s score is their mentees' average`,
      Math.abs(cs.averageScore - expected) < 0.15,
      `${cs.averageScore} over ${cs.menteeCount} mentees`,
    );
  }

  // --- organization ---------------------------------------------------------
  const org = await db.organization.findFirstOrThrow();
  const orgScore = await computeOrgScore(org.id);
  check(
    "organization score computed from all users",
    orgScore.memberCount > 0 && orgScore.averageScore > 0,
    `${orgScore.averageScore} over ${orgScore.memberCount} members`,
  );

  // --- history the charts depend on ----------------------------------------
  const snapshotDays = await db.scoreSnapshot.groupBy({ by: ["date"] });
  check(
    "60 days of score history exist",
    snapshotDays.length >= 60,
    `${snapshotDays.length} days`,
  );

  const boards = await db.leaderboardEntry.groupBy({ by: ["board"] });
  check(
    "leaderboard ranks captured (rank-delta works)",
    boards.length >= 4,
    boards.map((b) => b.board).join(", "),
  );

  console.log(
    failures === 0
      ? "\nAll checks passed.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
