import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { assertCanViewUser, visibleUserIds } from "@/lib/rbac";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/domain";

/**
 * The activity ledger. Every meaningful thing a mentee or their coach does
 * lands here, so timelines read from one table instead of each feature module
 * keeping its own history.
 */

export type ActivityPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type ActivityItem = {
  id: string;
  type: ActivityType;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  /** Whose timeline this belongs to. */
  user: ActivityPerson;
  /** Who performed it — null once a deleted actor's FK is nulled out. */
  actor: ActivityPerson | null;
};

const DEFAULT_LIMIT = 20;

function asActivityType(value: string): ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value)
    ? (value as ActivityType)
    : "COMMENT_ADDED";
}

/** Metadata round-trips through a TEXT column. */
function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function logActivity(input: {
  userId: string;
  actorId?: string | null;
  type: ActivityType;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.activityLog.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function recentActivity(
  actor: SessionUser,
  opts?: { userId?: string; limit?: number },
): Promise<ActivityItem[]> {
  const limit = opts?.limit ?? DEFAULT_LIMIT;

  let where: Prisma.ActivityLogWhereInput = { user: { isActive: true } };

  if (opts?.userId) {
    await assertCanViewUser(actor, opts.userId);
    where = { userId: opts.userId, user: { isActive: true } };
  } else {
    const allowed = await visibleUserIds(actor);
    // `null` means no restriction — never read it as "see nobody".
    if (allowed !== null) {
      where = { userId: { in: allowed }, user: { isActive: true } };
    }
  }

  const person = {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  } as const;

  const rows = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: person, actor: person },
  });

  return rows.map((row) => ({
    id: row.id,
    type: asActivityType(row.type),
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt,
    user: row.user,
    actor: row.actor,
  }));
}
