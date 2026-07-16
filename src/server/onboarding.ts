import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { GOAL_CATEGORY_KEYS, type GoalCategoryKey } from "@/lib/domain";
import { addDays, dayKey } from "@/lib/dates";
import { computeScoresForUsers } from "@/lib/scoring";
import { logActivity } from "@/server/activity";

/**
 * The onboarding wizard.
 *
 * Three product rules had to be reconciled with the design, and each is enforced
 * here rather than in the form:
 *
 *   Goals      — every goal must carry at least one task, because a goal's score
 *                *is* the share of its tasks that are done. The wizard collects a
 *                first task per realm; a goal without one is refused.
 *   Core tasks — the four daily disciplines are organization-wide and identical
 *                for everyone, so that step is a commitment, not a menu. Nothing
 *                per-user is written; opting out is not on offer.
 *   Circles    — normally only a coach places a mentee in a group. Self-join is
 *                allowed once, and only for someone who has no active membership,
 *                which is precisely the case the wizard exists to serve.
 */

export type OnboardingCircle = {
  id: string;
  name: string;
  description: string | null;
  coachName: string;
  memberCount: number;
  averageScore: number;
};

export type OnboardingState = {
  needsOnboarding: boolean;
  firstName: string;
  categories: {
    key: GoalCategoryKey;
    name: string;
    description: string | null;
  }[];
  coreTasks: {
    id: string;
    key: string;
    name: string;
    description: string | null;
  }[];
  circles: OnboardingCircle[];
  /** True when a coach has already placed them, so the circle step is read-only. */
  hasGroup: boolean;
};

export async function getOnboardingState(
  actor: SessionUser,
): Promise<OnboardingState> {
  const [categories, coreTasks, groups] = await Promise.all([
    db.goalCategory.findMany({
      where: { isRequired: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true, name: true, description: true },
    }),
    db.coreTask.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, key: true, name: true, description: true },
    }),
    db.coachGroup.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        coach: { select: { firstName: true, lastName: true } },
        memberships: { where: { isActive: true }, select: { menteeId: true } },
      },
    }),
  ]);

  // A circle's score is its members' average — the same figure the coach
  // leaderboard ranks on, so the wizard cannot advertise a number that differs
  // from the one the mentee sees the moment they land in the app.
  const allMemberIds = [
    ...new Set(groups.flatMap((g) => g.memberships.map((m) => m.menteeId))),
  ];
  const scores = await computeScoresForUsers(allMemberIds);

  const circles: OnboardingCircle[] = groups
    .map((group) => {
      const members = group.memberships.map((m) => m.menteeId);
      const theirScores = members
        .map((id) => scores.get(id)?.overallScore)
        .filter((s): s is number => s !== undefined);

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        coachName: `${group.coach.firstName} ${group.coach.lastName}`,
        memberCount: members.length,
        averageScore: theirScores.length
          ? Math.round(
              (theirScores.reduce((a, b) => a + b, 0) / theirScores.length) *
                10,
            ) / 10
          : 0,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

  return {
    needsOnboarding: actor.needsOnboarding,
    firstName: actor.firstName,
    categories: categories.map((c) => ({
      key: c.key as GoalCategoryKey,
      name: c.name,
      description: c.description,
    })),
    coreTasks,
    circles,
    hasGroup: actor.menteeGroupId !== null,
  };
}

export type OnboardingSubmission = {
  name: string;
  /** One goal per required category, each with its first task. */
  goals: Record<GoalCategoryKey, { title: string; firstTask: string }>;
  checkIn: { mood: number; wins: string };
  circleId: string | null;
};

const GOAL_HORIZON_DAYS = 90;

export async function completeOnboarding(
  actor: SessionUser,
  input: OnboardingSubmission,
): Promise<void> {
  if (!actor.needsOnboarding) {
    throw new ForbiddenError("You have already completed onboarding.");
  }

  // Everything is validated before the transaction opens, so a bad payload can
  // never leave a half-built account behind.
  for (const key of GOAL_CATEGORY_KEYS) {
    const goal = input.goals[key];
    if (!goal?.title?.trim()) {
      throw new ForbiddenError(`Set a ${key.toLowerCase()} goal to continue.`);
    }
    if (!goal.firstTask?.trim()) {
      throw new ForbiddenError(
        `Add a first task to your ${key.toLowerCase()} goal — a goal is scored by the work inside it.`,
      );
    }
  }

  const firstName = input.name.trim();
  if (!firstName) throw new ForbiddenError("Tell us what to call you.");

  const [categories, menteeRole, existingMembership] = await Promise.all([
    db.goalCategory.findMany({
      where: { key: { in: [...GOAL_CATEGORY_KEYS] } },
      select: { id: true, key: true },
    }),
    db.role.findUnique({ where: { key: "MENTEE" }, select: { id: true } }),
    db.groupMembership.findFirst({
      where: { menteeId: actor.id, isActive: true },
      select: { id: true },
    }),
  ]);

  // Self-join is only ever offered to someone with no coach yet. Re-checked here
  // rather than trusted from the form, so a replayed request cannot pull a mentee
  // out of the group their coach placed them in.
  const joiningGroupId =
    input.circleId && !existingMembership ? input.circleId : null;

  if (joiningGroupId) {
    const group = await db.coachGroup.findFirst({
      where: {
        id: joiningGroupId,
        isActive: true,
        organizationId: actor.organizationId,
      },
      select: { id: true },
    });
    if (!group) throw new ForbiddenError("That circle is not available.");
  }

  const now = new Date();
  const today = dayKey(now);
  const targetDate = dayKey(addDays(now, GOAL_HORIZON_DAYS));
  const mood = Math.min(5, Math.max(1, Math.round(input.checkIn.mood)));

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { firstName, onboardedAt: now },
    });

    for (const key of GOAL_CATEGORY_KEYS) {
      const category = categories.find((c) => c.key === key);
      if (!category) continue;

      const goal = input.goals[key];
      await tx.goal.create({
        data: {
          userId: actor.id,
          categoryId: category.id,
          title: goal.title.trim(),
          status: "IN_PROGRESS",
          progress: 0,
          targetDate,
          tasks: { create: [{ title: goal.firstTask.trim(), sortOrder: 0 }] },
        },
      });
    }

    // The first check-in is what starts the streak — day one of the story.
    const wins = input.checkIn.wins.trim();
    await tx.dailyCheckIn.upsert({
      where: { userId_date: { userId: actor.id, date: today } },
      create: { userId: actor.id, date: today, mood, wins: wins || null },
      update: { mood, wins: wins || null },
    });

    if (joiningGroupId) {
      await tx.groupMembership.upsert({
        where: {
          groupId_menteeId: { groupId: joiningGroupId, menteeId: actor.id },
        },
        create: { groupId: joiningGroupId, menteeId: actor.id },
        update: { isActive: true, leftAt: null, joinedAt: now },
      });

      // Being in a circle *is* being a mentee — the role follows the fact.
      if (menteeRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: actor.id, roleId: menteeRole.id } },
          create: { userId: actor.id, roleId: menteeRole.id },
          update: {},
        });
      }
    }
  });

  await logActivity({
    userId: actor.id,
    actorId: actor.id,
    type: "MEMBER_JOINED",
    summary: `${firstName} entered Abundance 12 — three goals set and the first check-in logged.`,
    metadata: { circleId: joiningGroupId },
  });
}
