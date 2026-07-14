import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

/**
 * Visibility rules for Abundance Hub, in one place.
 *
 *   Mentee — sees themselves, their coach, and the members of their own coach
 *            group. Nothing from any other group.
 *   Coach  — reads every group, member and score in the organization; writes
 *            only to their own mentees, unless another coach has delegated.
 *   Admin  — unrestricted.
 *
 * Read rules answer "may I see this?"; write rules answer "may I change this?".
 * They are deliberately different questions: a coach comparing themselves
 * against another coach's group is expected, editing that group's goals is not.
 */

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// Membership lookups
// ---------------------------------------------------------------------------

/** Mentee ids inside a given coach group. */
export const groupMemberIds = cache(
  async (groupId: string): Promise<string[]> => {
    const rows = await db.groupMembership.findMany({
      where: { groupId, isActive: true },
      select: { menteeId: true },
    });
    return rows.map((r) => r.menteeId);
  },
);

/** Mentee ids across every group this coach runs. */
export const coachMenteeIds = cache(
  async (coachId: string): Promise<string[]> => {
    const rows = await db.groupMembership.findMany({
      where: { isActive: true, group: { coachId, isActive: true } },
      select: { menteeId: true },
    });
    return [...new Set(rows.map((r) => r.menteeId))];
  },
);

/** Mentees another coach has explicitly delegated to this one, still in date. */
export const delegatedMenteeIds = cache(
  async (coachId: string): Promise<string[]> => {
    const now = new Date();
    const grants = await db.coachDelegation.findMany({
      where: {
        granteeId: coachId,
        permission: "EDIT",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { menteeId: true, groupId: true },
    });

    const direct = grants
      .map((g) => g.menteeId)
      .filter((id): id is string => Boolean(id));

    // A grant scoped to a whole group covers every mentee currently inside it.
    const groupIds = grants
      .map((g) => g.groupId)
      .filter((id): id is string => Boolean(id));

    const viaGroups = groupIds.length
      ? await db.groupMembership
          .findMany({
            where: { groupId: { in: groupIds }, isActive: true },
            select: { menteeId: true },
          })
          .then((rows) => rows.map((r) => r.menteeId))
      : [];

    return [...new Set([...direct, ...viaGroups])];
  },
);

// ---------------------------------------------------------------------------
// Read access
// ---------------------------------------------------------------------------

/**
 * Every user the actor may see. `null` means "no restriction" — admins and
 * coaches see the whole organization. Callers must read `null` as "add no WHERE
 * clause", never as "see nobody".
 */
export async function visibleUserIds(
  actor: SessionUser,
): Promise<string[] | null> {
  if (actor.isAdmin || actor.isCoach) return null;

  // A mentee sees their own group — and themselves, even before a coach has
  // placed them in one.
  if (!actor.menteeGroupId) return [actor.id];

  const [members, group] = await Promise.all([
    groupMemberIds(actor.menteeGroupId),
    db.coachGroup.findUnique({
      where: { id: actor.menteeGroupId },
      select: { coachId: true },
    }),
  ]);

  return [
    ...new Set([actor.id, ...members, ...(group ? [group.coachId] : [])]),
  ];
}

export async function canViewUser(
  actor: SessionUser,
  targetId: string,
): Promise<boolean> {
  if (actor.id === targetId) return true;
  const allowed = await visibleUserIds(actor);
  return allowed === null || allowed.includes(targetId);
}

export async function assertCanViewUser(
  actor: SessionUser,
  targetId: string,
): Promise<void> {
  if (!(await canViewUser(actor, targetId))) {
    throw new ForbiddenError("That member is outside your coaching group.");
  }
}

/** Coaches and admins may open any group; a mentee only their own. */
export function canViewGroup(actor: SessionUser, groupId: string): boolean {
  if (actor.isAdmin || actor.isCoach) return true;
  return actor.menteeGroupId === groupId;
}

export function assertCanViewGroup(actor: SessionUser, groupId: string): void {
  if (!canViewGroup(actor, groupId)) {
    throw new ForbiddenError("That coaching group is not visible to you.");
  }
}

// ---------------------------------------------------------------------------
// Write access
// ---------------------------------------------------------------------------

/** True when the mentee sits in one of the coach's own groups. */
export async function coachesMentee(
  actor: SessionUser,
  menteeId: string,
): Promise<boolean> {
  if (!actor.isCoach) return false;
  const mine = await coachMenteeIds(actor.id);
  return mine.includes(menteeId);
}

/**
 * May the actor write to this mentee's record — set goals, log tasks, resolve
 * action items? Own mentees yes; another coach's mentees only with a live
 * delegation. Users always own their own data.
 */
export async function canEditMentee(
  actor: SessionUser,
  menteeId: string,
): Promise<boolean> {
  if (actor.isAdmin) return true;
  if (actor.id === menteeId) return true;
  if (await coachesMentee(actor, menteeId)) return true;

  if (actor.isCoach) {
    const delegated = await delegatedMenteeIds(actor.id);
    return delegated.includes(menteeId);
  }
  return false;
}

export async function assertCanEditMentee(
  actor: SessionUser,
  menteeId: string,
): Promise<void> {
  if (!(await canEditMentee(actor, menteeId))) {
    throw new ForbiddenError(
      "You are not authorized to edit this mentee. Ask their coach to delegate access.",
    );
  }
}

/**
 * Coaching notes are the one thing a coach may write about a mentee they do not
 * own — an observation is not an edit. A mentee may never author notes.
 */
export function canWriteNoteAbout(actor: SessionUser): boolean {
  return actor.isCoach || actor.isAdmin;
}

/** Private notes stay with their author (and admins). */
export function canReadNote(
  actor: SessionUser,
  note: { coachId: string; menteeId: string; visibility: string },
): boolean {
  if (actor.isAdmin) return true;
  if (note.coachId === actor.id) return true;
  if (note.menteeId === actor.id) return note.visibility === "SHARED";
  // A coach may read a colleague's shared notes, never their private ones.
  return actor.isCoach && note.visibility === "SHARED";
}

// ---------------------------------------------------------------------------
// Leaderboard scoping
// ---------------------------------------------------------------------------

/** The group leaderboards the actor may open. `null` means every group. */
export async function accessibleGroupIds(
  actor: SessionUser,
): Promise<string[] | null> {
  if (actor.isAdmin || actor.isCoach) return null;
  return actor.menteeGroupId ? [actor.menteeGroupId] : [];
}
