/**
 * Drives the onboarding wizard's server layer end to end and asserts on what it
 * actually wrote — a rendered form proves nothing about the rows behind it.
 *
 * `src/server/**` is guarded with `import "server-only"`, which throws under
 * plain Node. Running with `--conditions=react-server` resolves that package to
 * the same no-op Next uses, so the real module is exercised rather than a copy:
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-onboarding.ts
 */
import "./env";
import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/auth";
import { dayKey } from "../src/lib/dates";
import { computeUserScore } from "../src/lib/scoring";
import {
  completeOnboarding,
  getOnboardingState,
} from "../src/server/onboarding";

const EMAIL = "newcomer@abundancehub.io";

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

/** The SessionUser the app hands a signed-in visitor. */
async function sessionFor(email: string): Promise<SessionUser> {
  const u = await db.user.findUniqueOrThrow({
    where: { email },
    include: {
      roles: { include: { role: true } },
      coachGroups: { where: { isActive: true } },
      memberships: { where: { isActive: true } },
    },
  });

  const roles = u.roles.map((r) => r.role.key) as SessionUser["roles"];

  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    avatarUrl: u.avatarUrl,
    headline: u.headline,
    organizationId: u.organizationId,
    roles,
    isAdmin: roles.includes("ADMIN"),
    isCoach: roles.includes("COACH"),
    isMentee: roles.includes("MENTEE"),
    coachGroupIds: u.coachGroups.map((g) => g.id),
    menteeGroupId: u.memberships[0]?.groupId ?? null,
    joinedAt: u.joinedAt,
    needsOnboarding: u.onboardedAt === null,
  };
}

async function freshSignup(organizationId: string): Promise<SessionUser> {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.user.create({
    data: {
      organizationId,
      email: EMAIL,
      passwordHash: await bcrypt.hash("Abundance123!", 12),
      firstName: "Casey",
      lastName: "Nguyen",
    },
  });
  return sessionFor(EMAIL);
}

async function main() {
  console.log("\nAbundance Hub — onboarding\n");

  const org = await db.organization.findFirstOrThrow();
  const actor = await freshSignup(org.id);

  check("a new signup starts out owing onboarding", actor.needsOnboarding);

  const state = await getOnboardingState(actor);
  check(
    "the wizard offers the real circles, with real scores",
    state.circles.length === 3,
    state.circles.map((c) => `${c.name} ${c.averageScore}`).join(" · "),
  );
  check(
    "and the four organization-wide core tasks",
    state.coreTasks.length === 4,
    state.coreTasks.map((t) => t.key).join(", "),
  );

  const circle = state.circles[0];

  await completeOnboarding(actor, {
    name: "Casey",
    goals: {
      PERSONAL: {
        title: "Run a half marathon",
        firstTask: "Book a gym induction",
      },
      PROFESSIONAL: {
        title: "Get promoted to senior",
        firstTask: "Ask my lead what is missing",
      },
      CONTRIBUTION: {
        title: "Mentor two juniors",
        firstTask: "Offer to pair on Fridays",
      },
    },
    checkIn: { mood: 4, wins: "Signed up and set my three goals." },
    circleId: circle.id,
  });

  const after = await db.user.findUniqueOrThrow({
    where: { email: EMAIL },
    include: {
      goals: { include: { tasks: true, category: true } },
      memberships: { where: { isActive: true }, include: { group: true } },
      checkIns: true,
      roles: { include: { role: true } },
    },
  });

  check("onboardedAt is stamped", after.onboardedAt !== null);
  check(
    "one goal in each of the three required realms",
    after.goals.length === 3 &&
      new Set(after.goals.map((g) => g.category.key)).size === 3,
    after.goals
      .map((g) => g.category.key)
      .sort()
      .join(", "),
  );
  check(
    "EVERY goal carries a task list",
    after.goals.every((g) => g.tasks.length >= 1),
    after.goals.map((g) => `${g.tasks.length} task`).join(" · "),
  );
  check(
    "the first check-in is logged against today",
    after.checkIns.length === 1 &&
      after.checkIns[0].date.getTime() === dayKey(new Date()).getTime(),
    `mood ${after.checkIns[0]?.mood}`,
  );
  check(
    "they joined exactly one circle",
    after.memberships.length === 1,
    after.memberships[0]?.group.name,
  );
  check(
    "joining a circle granted the MENTEE role",
    after.roles.some((r) => r.role.key === "MENTEE"),
  );

  const score = await computeUserScore(after.id);
  check(
    "they land in the app with a real score, not zero",
    score.overallScore > 0,
    `overall ${score.overallScore} · goals ${score.goalScore} · streak ${score.currentStreak}`,
  );

  // The wizard writes goals and a membership; replaying it would duplicate both.
  const replayed = await sessionFor(EMAIL);
  let refused = false;
  try {
    await completeOnboarding(replayed, {
      name: "Casey",
      goals: {
        PERSONAL: { title: "dupe", firstTask: "dupe" },
        PROFESSIONAL: { title: "dupe", firstTask: "dupe" },
        CONTRIBUTION: { title: "dupe", firstTask: "dupe" },
      },
      checkIn: { mood: 3, wins: "" },
      circleId: circle.id,
    });
  } catch {
    refused = true;
  }
  check("the wizard cannot be replayed", refused);

  // A goal with no task is refused here too — the same rule the rest of the app
  // enforces, since a goal's score IS the share of its tasks that are done.
  const fresh = await freshSignup(org.id);

  let rejectedTaskless = false;
  try {
    await completeOnboarding(fresh, {
      name: "Casey",
      goals: {
        PERSONAL: { title: "A goal with no task", firstTask: "   " },
        PROFESSIONAL: { title: "x", firstTask: "y" },
        CONTRIBUTION: { title: "x", firstTask: "y" },
      },
      checkIn: { mood: 3, wins: "" },
      circleId: circle.id,
    });
  } catch {
    rejectedTaskless = true;
  }
  check("a goal with no first task is refused", rejectedTaskless);
  check(
    "and nothing was half-written when it was refused",
    (await db.goal.count({ where: { userId: fresh.id } })) === 0,
  );

  await db.user.deleteMany({ where: { email: EMAIL } });

  console.log(
    failures === 0
      ? "\nOnboarding writes exactly what it should.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
