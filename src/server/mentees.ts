import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  assertCanViewGroup,
  assertCanViewUser,
  canEditMentee,
  groupMemberIds,
  visibleUserIds,
} from "@/lib/rbac";
import {
  averageScore,
  computeScoresForUsers,
  computeUserScore,
  emptyScore,
  type UserScore,
} from "@/lib/scoring";
import { daysBetween } from "@/lib/dates";

/**
 * The coach's view of people.
 *
 * Reads are org-wide for a coach — comparing your group against another's is
 * expected, and the spec is explicit that "Coaches can view the members of
 * other coaches". A mentee is confined to their own group by `visibleUserIds`.
 */

export type MenteeCard = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  headline: string | null;
  groupId: string | null;
  groupName: string | null;
  coachName: string | null;
  overallScore: number;
  currentStreak: number;
  goalsCompleted: number;
  goalsTotal: number;
  taskCompletionRate: number;
  lastActiveAt: Date | null;
  isActive: boolean;
  isAtRisk: boolean;
};

export type GroupPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type MenteeProfile = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    headline: string | null;
    bio: string | null;
    timezone: string;
    isActive: boolean;
    lastActiveAt: Date | null;
  };
  score: UserScore;
  group: { id: string; name: string; coach: GroupPerson } | null;
  canEdit: boolean;
  joinedAt: Date;
};

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  coach: GroupPerson;
  memberCount: number;
  averageScore: number;
};

export type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  coach: GroupPerson;
  members: MenteeCard[];
  averageScore: number;
};

/** Below this, a mentee needs a conversation rather than a leaderboard. */
const AT_RISK_SCORE = 40;
const STALE_DAYS = 7;

const person = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
} as const;

const round = (n: number) => Math.round(n * 10) / 10;

function mean(cards: MenteeCard[]): number {
  if (!cards.length) return 0;
  return round(
    cards.reduce((sum, c) => sum + c.overallScore, 0) / cards.length,
  );
}

/**
 * Builds the cards for a set of users in a fixed number of queries — the scores
 * for the whole list are computed in one pass, never one user at a time inside
 * a loop.
 */
async function cardsForUserIds(
  userIds: string[],
  asOf: Date = new Date(),
): Promise<MenteeCard[]> {
  if (userIds.length === 0) return [];

  const [users, scores] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        headline: true,
        isActive: true,
        lastActiveAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            group: {
              select: {
                id: true,
                name: true,
                coach: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
    computeScoresForUsers(userIds, asOf),
  ]);

  const cards = users.map((user) => {
    const score = scores.get(user.id) ?? emptyScore(user.id);

    // The one-group invariant means there is at most one active membership.
    const group = user.memberships[0]?.group ?? null;

    const stale =
      !user.lastActiveAt || daysBetween(user.lastActiveAt, asOf) > STALE_DAYS;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      headline: user.headline,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      coachName: group
        ? `${group.coach.firstName} ${group.coach.lastName}`
        : null,
      overallScore: score.overallScore,
      currentStreak: score.currentStreak,
      goalsCompleted: score.goalsCompleted,
      goalsTotal: score.goalsTotal,
      taskCompletionRate: score.taskCompletionRate,
      lastActiveAt: user.lastActiveAt,
      isActive: user.isActive,
      isAtRisk: score.overallScore < AT_RISK_SCORE || stale,
    };
  });

  return cards.sort(
    (a, b) =>
      b.overallScore - a.overallScore || a.lastName.localeCompare(b.lastName),
  );
}

// ---------------------------------------------------------------------------
// Mentees
// ---------------------------------------------------------------------------

export async function listMentees(
  actor: SessionUser,
  opts?: { groupId?: string; search?: string },
): Promise<MenteeCard[]> {
  const allowed = await visibleUserIds(actor);
  const search = opts?.search?.trim();

  const rows = await db.user.findMany({
    where: {
      organizationId: actor.organizationId,
      roles: { some: { role: { key: "MENTEE" } } },
      // `null` means no restriction — a coach or admin sees the whole org.
      ...(allowed === null ? {} : { id: { in: allowed } }),
      ...(opts?.groupId
        ? { memberships: { some: { groupId: opts.groupId, isActive: true } } }
        : {}),
      // SQLite's LIKE is already case-insensitive for ASCII, so Prisma's
      // `mode: "insensitive"` (unsupported on this provider) is not needed.
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    select: { id: true },
  });

  return cardsForUserIds(rows.map((r) => r.id));
}

export async function getMenteeProfile(
  actor: SessionUser,
  menteeId: string,
): Promise<MenteeProfile> {
  await assertCanViewUser(actor, menteeId);

  const [user, score, canEdit] = await Promise.all([
    db.user.findUnique({
      where: { id: menteeId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        headline: true,
        bio: true,
        timezone: true,
        isActive: true,
        joinedAt: true,
        lastActiveAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            group: { select: { id: true, name: true, coach: person } },
          },
        },
      },
    }),
    computeUserScore(menteeId),
    canEditMentee(actor, menteeId),
  ]);

  if (!user) throw new Error("That member no longer exists.");

  const group = user.memberships[0]?.group ?? null;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      headline: user.headline,
      bio: user.bio,
      timezone: user.timezone,
      isActive: user.isActive,
      lastActiveAt: user.lastActiveAt,
    },
    score,
    group: group
      ? { id: group.id, name: group.name, coach: group.coach }
      : null,
    canEdit,
    joinedAt: user.joinedAt,
  };
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function listGroups(actor: SessionUser): Promise<GroupSummary[]> {
  const allowed = await visibleUserIds(actor);

  const groups = await db.coachGroup.findMany({
    where: {
      organizationId: actor.organizationId,
      // A mentee sees only the group they are actually in.
      ...(allowed === null
        ? {}
        : { memberships: { some: { menteeId: actor.id, isActive: true } } }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      coach: person,
      memberships: {
        where: { isActive: true },
        select: { menteeId: true },
      },
    },
  });

  // One scoring pass across every member of every group, not one pass per group.
  const memberIds = [
    ...new Set(groups.flatMap((g) => g.memberships.map((m) => m.menteeId))),
  ];
  const scores = await computeScoresForUsers(memberIds);

  return groups.map((group) => {
    const memberScores = group.memberships
      .map((m) => scores.get(m.menteeId))
      .filter((s): s is UserScore => Boolean(s));

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      isActive: group.isActive,
      coach: group.coach,
      memberCount: group.memberships.length,
      averageScore: averageScore(memberScores),
    };
  });
}

export async function getGroup(
  actor: SessionUser,
  groupId: string,
): Promise<GroupDetail> {
  assertCanViewGroup(actor, groupId);

  const group = await db.coachGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      coach: person,
      memberships: {
        where: { isActive: true },
        select: { menteeId: true },
      },
    },
  });

  if (!group) throw new Error("That coaching group no longer exists.");

  const members = await cardsForUserIds(
    group.memberships.map((m) => m.menteeId),
  );

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    coach: group.coach,
    members,
    averageScore: mean(members),
  };
}

/** A mentee's own group roster. Empty for anyone not yet placed in a group. */
export async function myGroupMembers(
  actor: SessionUser,
): Promise<MenteeCard[]> {
  if (!actor.menteeGroupId) return [];
  const ids = await groupMemberIds(actor.menteeGroupId);
  return cardsForUserIds(ids);
}
