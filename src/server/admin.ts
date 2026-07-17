import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { hashPassword, type SessionUser } from "@/lib/auth";
import { ForbiddenError, coachMenteeIds } from "@/lib/rbac";
import { NOTIFICATION_TYPES, asRoleKey, type RoleKey } from "@/lib/domain";
import { logActivity } from "@/server/activity";

/**
 * Administration.
 *
 * Everything here is admin-only *except* the parts a coach must be able to run
 * for their own group: creating and renaming it, moving mentees in and out of
 * it, and delegating their own mentees to a colleague. Those exceptions are
 * narrow, and each one re-checks that the actor really owns what they touch.
 */

export type AdminUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  roles: RoleKey[];
  groupName: string | null;
  joinedAt: Date;
  lastActiveAt: Date | null;
};

const person = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
} as const;

function requireAdmin(actor: SessionUser): void {
  if (!actor.isAdmin) {
    throw new ForbiddenError("Administrator access is required.");
  }
}

/** A coach manages the groups they lead; an admin manages all of them. */
async function assertManagesGroup(
  actor: SessionUser,
  groupId: string,
): Promise<void> {
  const group = await db.coachGroup.findUnique({
    where: { id: groupId },
    select: { coachId: true, organizationId: true },
  });

  if (!group || group.organizationId !== actor.organizationId) {
    throw new ForbiddenError("That council is outside your organization.");
  }

  if (!actor.isAdmin && group.coachId !== actor.id) {
    throw new ForbiddenError("You do not lead that coaching group.");
  }
}

async function roleIdsFor(keys: RoleKey[]): Promise<string[]> {
  const wanted = [...new Set(keys)];
  if (wanted.length === 0) return [];

  const rows = await db.role.findMany({
    where: { key: { in: wanted } },
    select: { id: true, key: true },
  });

  const missing = wanted.filter((key) => !rows.some((r) => r.key === key));
  if (missing.length) {
    throw new Error(
      `Unknown role: ${missing.join(", ")}. Seed the roles first.`,
    );
  }

  return rows.map((r) => r.id);
}

async function assertActiveCoach(
  actor: SessionUser,
  coachId: string,
): Promise<void> {
  const coach = await db.user.findFirst({
    where: {
      id: coachId,
      organizationId: actor.organizationId,
      isActive: true,
      roles: { some: { role: { key: "COACH" } } },
    },
    select: { id: true },
  });

  if (!coach) {
    throw new ForbiddenError("Choose an active coach in your organization.");
  }
}

/**
 * The core invariant: **a mentee belongs to exactly one coach group.** Every
 * other active membership is closed before the new one opens, and the whole
 * move is one transaction — so a crash can never leave a mentee in two groups,
 * or in none.
 */
async function placeInGroup(
  tx: Prisma.TransactionClient,
  menteeId: string,
  groupId: string,
): Promise<void> {
  const now = new Date();

  await tx.groupMembership.updateMany({
    where: { menteeId, isActive: true, NOT: { groupId } },
    data: { isActive: false, leftAt: now },
  });

  // A mentee may re-join a group they once left, and the unique
  // [groupId, menteeId] pair makes that an update rather than a second row.
  await tx.groupMembership.upsert({
    where: { groupId_menteeId: { groupId, menteeId } },
    create: { groupId, menteeId },
    update: { isActive: true, leftAt: null, joinedAt: now },
  });

  // Being in a coach group *is* being a mentee — the role follows the fact.
  const menteeRole = await tx.role.findUnique({
    where: { key: "MENTEE" },
    select: { id: true },
  });

  if (menteeRole) {
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: menteeId, roleId: menteeRole.id } },
      create: { userId: menteeId, roleId: menteeRole.id },
      update: {},
    });
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(
  actor: SessionUser,
  opts?: { search?: string; role?: RoleKey },
): Promise<AdminUserRow[]> {
  requireAdmin(actor);

  const search = opts?.search?.trim();

  const rows = await db.user.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      ...(opts?.role ? { roles: { some: { role: { key: opts.role } } } } : {}),
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
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      isActive: true,
      joinedAt: true,
      lastActiveAt: true,
      roles: { select: { role: { select: { key: true } } } },
      memberships: {
        where: {
          isActive: true,
          group: { isActive: true, coach: { isActive: true } },
        },
        select: { group: { select: { name: true } } },
      },
    },
  });

  return rows.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    roles: user.roles.map((r) => asRoleKey(r.role.key)),
    groupName: user.memberships[0]?.group.name ?? null,
    joinedAt: user.joinedAt,
    lastActiveAt: user.lastActiveAt,
  }));
}

export async function createUser(
  actor: SessionUser,
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    headline?: string;
    roles: RoleKey[];
    groupId?: string;
  },
): Promise<string> {
  requireAdmin(actor);

  // Email is the login identity and is unique — normalising it here is what
  // stops "Ada@x.com" and "ada@x.com" becoming two accounts.
  const email = input.email.toLowerCase().trim();

  const [passwordHash, roleIds] = await Promise.all([
    hashPassword(input.password),
    roleIdsFor(input.roles),
  ]);

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: actor.organizationId,
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        headline: input.headline?.trim() || null,
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
        notificationPrefs: {
          create: NOTIFICATION_TYPES.map((type) => ({
            type,
            inApp: true,
            email: false,
          })),
        },
      },
      select: { id: true },
    });

    if (input.groupId) await placeInGroup(tx, user.id, input.groupId);

    return user.id;
  });
}

export async function updateUser(
  actor: SessionUser,
  userId: string,
  input: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    bio?: string;
    email?: string;
    isActive?: boolean;
  },
): Promise<void> {
  requireAdmin(actor);

  await db.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName === undefined
        ? {}
        : { firstName: input.firstName.trim() }),
      ...(input.lastName === undefined
        ? {}
        : { lastName: input.lastName.trim() }),
      ...(input.headline === undefined
        ? {}
        : { headline: input.headline.trim() || null }),
      ...(input.bio === undefined ? {} : { bio: input.bio.trim() || null }),
      ...(input.email === undefined
        ? {}
        : { email: input.email.toLowerCase().trim() }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
  });
}

export async function setUserRoles(
  actor: SessionUser,
  userId: string,
  roles: RoleKey[],
): Promise<void> {
  requireAdmin(actor);

  // An admin demoting themselves would lock the last door behind them.
  if (userId === actor.id && !roles.includes("ADMIN")) {
    throw new ForbiddenError(
      "You cannot remove your own administrator role. Ask another admin.",
    );
  }

  const roleIds = await roleIdsFor(roles);

  await db.$transaction([
    db.userRole.deleteMany({
      where: { userId, NOT: { roleId: { in: roleIds } } },
    }),
    ...roleIds.map((roleId) =>
      db.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        create: { userId, roleId },
        update: {},
      }),
    ),
  ]);
}

export async function resetPassword(
  actor: SessionUser,
  userId: string,
  newPassword: string,
): Promise<void> {
  requireAdmin(actor);

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroup(
  actor: SessionUser,
  input: { name: string; description?: string; coachId: string },
): Promise<string> {
  const coachId = input.coachId.trim();

  // A coach may open a group — but only one they will lead themselves.
  if (!actor.isAdmin && !(actor.isCoach && coachId === actor.id)) {
    throw new ForbiddenError("A coach may only create groups they lead.");
  }
  await assertActiveCoach(actor, coachId);

  const group = await db.coachGroup.create({
    data: {
      organizationId: actor.organizationId,
      coachId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    },
    select: { id: true },
  });

  return group.id;
}

export async function updateGroup(
  actor: SessionUser,
  groupId: string,
  input: {
    name?: string;
    description?: string;
    isActive?: boolean;
    coachId?: string;
  },
): Promise<void> {
  await assertManagesGroup(actor, groupId);

  if (input.coachId !== undefined && !actor.isAdmin) {
    throw new ForbiddenError("Only an administrator may change a council coach.");
  }

  const coachId = input.coachId?.trim();
  if (input.coachId !== undefined) {
    if (!coachId) {
      throw new ForbiddenError("Choose an active coach in your organization.");
    }
    await assertActiveCoach(actor, coachId);
  }

  await db.coachGroup.update({
    where: { id: groupId },
    data: {
      ...(coachId === undefined ? {} : { coachId }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.description === undefined
        ? {}
        : { description: input.description.trim() || null }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
  });
}

export async function assignMenteeToGroup(
  actor: SessionUser,
  menteeId: string,
  groupId: string,
): Promise<void> {
  await assertManagesGroup(actor, groupId);
  await db.$transaction((tx) => placeInGroup(tx, menteeId, groupId));
}

export async function removeMenteeFromGroup(
  actor: SessionUser,
  menteeId: string,
  groupId: string,
): Promise<void> {
  await assertManagesGroup(actor, groupId);

  // Soft-close the membership: the row is the record that they were once here,
  // and deleting it would erase that history.
  await db.groupMembership.updateMany({
    where: { menteeId, groupId, isActive: true },
    data: { isActive: false, leftAt: new Date() },
  });
}

/**
 * Self-service placement: a member moves *themselves* into a council. Unlike a
 * coach placement there is no ownership check — the guards are only that the
 * council is real, active and in the actor's own organization. The move reuses
 * the same one-council transaction (so any current membership is closed), and
 * the join is logged so the receiving coach sees it in their activity feed.
 */
export async function changeOwnCouncil(
  actor: SessionUser,
  groupId: string,
): Promise<{ name: string }> {
  const group = await db.coachGroup.findFirst({
    where: { id: groupId, isActive: true, organizationId: actor.organizationId },
    select: { id: true, name: true },
  });
  if (!group) throw new ForbiddenError("That council is not available.");

  // Already there: nothing to move, and no spurious "joined" entry.
  const current = await db.groupMembership.findFirst({
    where: { menteeId: actor.id, isActive: true },
    select: { groupId: true },
  });
  if (current?.groupId === groupId) return { name: group.name };

  await db.$transaction((tx) => placeInGroup(tx, actor.id, groupId));

  await logActivity({
    userId: actor.id,
    actorId: actor.id,
    type: "MEMBER_JOINED",
    summary: `${actor.firstName} ${actor.lastName} joined ${group.name}.`,
    metadata: { groupId },
  });

  return { name: group.name };
}

// ---------------------------------------------------------------------------
// Core tasks
// ---------------------------------------------------------------------------

export async function listCoreTasks(
  actor: SessionUser,
  organizationId: string,
) {
  requireAdmin(actor);

  return db.coreTask.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function upsertCoreTask(
  actor: SessionUser,
  input: {
    id?: string;
    organizationId: string;
    key: string;
    name: string;
    description?: string;
    icon?: string;
    points?: number;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<void> {
  requireAdmin(actor);

  const key = input.key.trim();

  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    ...(input.icon === undefined ? {} : { icon: input.icon }),
    ...(input.points === undefined ? {} : { points: input.points }),
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  };

  if (input.id) {
    await db.coreTask.update({
      where: { id: input.id },
      data: { key, ...data },
    });
    return;
  }

  await db.coreTask.upsert({
    where: {
      organizationId_key: { organizationId: input.organizationId, key },
    },
    create: { organizationId: input.organizationId, key, ...data },
    update: data,
  });
}

// ---------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------

export async function listDelegations(actor: SessionUser, coachId: string) {
  if (!actor.isAdmin && actor.id !== coachId) {
    throw new ForbiddenError("You may only see delegations you granted.");
  }

  const rows = await db.coachDelegation.findMany({
    where: { grantorId: coachId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      permission: true,
      expiresAt: true,
      createdAt: true,
      grantee: person,
      mentee: person,
      group: { select: { id: true, name: true } },
    },
  });

  // Whether a grant is still live is domain logic, not presentation. Deciding it
  // here — against one request-time clock read — keeps every consumer agreeing,
  // and keeps pages from calling Date.now() during render, which React forbids.
  const now = new Date();
  return rows.map((row) => ({
    ...row,
    isExpired: row.expiresAt !== null && row.expiresAt <= now,
  }));
}

/**
 * A coach lends access to their own mentees. The grant is always recorded
 * against the actor, so the audit trail names a person rather than a role.
 */
export async function grantDelegation(
  actor: SessionUser,
  input: {
    granteeId: string;
    menteeId?: string;
    groupId?: string;
    permission?: string;
    expiresAt?: Date | null;
  },
): Promise<void> {
  if (!actor.isAdmin && !actor.isCoach) {
    throw new ForbiddenError("Only a coach may delegate access.");
  }

  if (!input.menteeId && !input.groupId) {
    throw new Error("A delegation must name either a mentee or a group.");
  }

  if (!actor.isAdmin) {
    if (input.menteeId) {
      const mine = await coachMenteeIds(actor.id);
      if (!mine.includes(input.menteeId)) {
        throw new ForbiddenError("You may only delegate your own mentees.");
      }
    }

    if (input.groupId) await assertManagesGroup(actor, input.groupId);
  }

  await db.coachDelegation.create({
    data: {
      grantorId: actor.id,
      granteeId: input.granteeId,
      menteeId: input.menteeId ?? null,
      groupId: input.groupId ?? null,
      permission: input.permission ?? "EDIT",
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function revokeDelegation(
  actor: SessionUser,
  delegationId: string,
): Promise<void> {
  const delegation = await db.coachDelegation.findUnique({
    where: { id: delegationId },
    select: { grantorId: true },
  });

  if (!delegation) return;

  if (!actor.isAdmin && delegation.grantorId !== actor.id) {
    throw new ForbiddenError("You may only revoke delegations you granted.");
  }

  await db.coachDelegation.delete({ where: { id: delegationId } });
}
