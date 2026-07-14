import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import {
  LEADERBOARD_LABELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  asBoard,
  asNotificationType,
  type NotificationPriority,
  type NotificationType,
} from "@/lib/domain";
import { addDays, dayKey, daysUntil } from "@/lib/dates";

import { checkAchievements } from "./achievements";

/**
 * Notifications.
 *
 * Two halves: a small inbox API, and the sweep that fills it. The sweep is the
 * only thing that decides *when* a user should hear about something, so the
 * rules live in exactly one place and a route or cron job just calls it.
 */

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: Date;
};

export type NotificationPreferences = Record<
  NotificationType,
  { inApp: boolean; email: boolean }
>;

const DEFAULT_LIMIT = 30;

function asPriority(value: string): NotificationPriority {
  return (NOTIFICATION_PRIORITIES as readonly string[]).includes(value)
    ? (value as NotificationPriority)
    : "NORMAL";
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function listNotifications(
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId, ...(opts?.unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? DEFAULT_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    type: asNotificationType(row.type),
    title: row.title,
    body: row.body,
    link: row.link,
    priority: asPriority(row.priority),
    isRead: row.isRead,
    createdAt: row.createdAt,
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}

/** A notification is private to its recipient — not even an admin marks it read. */
export async function markRead(
  actor: SessionUser,
  notificationId: string,
): Promise<void> {
  const row = await db.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  // A missing row and someone else's row fail the same way, so the endpoint
  // cannot be used to probe which notification ids exist.
  if (!row || row.userId !== actor.id) {
    throw new ForbiddenError("That notification is not yours.");
  }

  await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(actor: SessionUser): Promise<void> {
  await db.notification.updateMany({
    where: { userId: actor.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  priority?: NotificationPriority;
};

/**
 * Absence of a preference row means opted in — a user who has never touched
 * their settings still hears about a missed task. Only an explicit
 * `inApp: false` silences a type.
 *
 * Returns whether a row was actually written, which is what lets the sweep
 * report how many notifications it created.
 */
async function deliver(input: NotifyInput): Promise<boolean> {
  const pref = await db.notificationPreference.findUnique({
    where: { userId_type: { userId: input.userId, type: input.type } },
    select: { inApp: true },
  });

  if (pref && !pref.inApp) return false;

  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      priority: input.priority ?? "NORMAL",
    },
  });

  return true;
}

export async function notify(input: NotifyInput): Promise<void> {
  await deliver(input);
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export async function getPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const rows = await db.notificationPreference.findMany({
    where: { userId },
    select: { type: true, inApp: true, email: true },
  });

  const prefs = {} as NotificationPreferences;
  for (const type of NOTIFICATION_TYPES) {
    prefs[type] = { inApp: true, email: false };
  }
  for (const row of rows) {
    prefs[asNotificationType(row.type)] = {
      inApp: row.inApp,
      email: row.email,
    };
  }

  return prefs;
}

/** A user only ever sets their own preferences. */
export async function setPreference(
  actor: SessionUser,
  type: NotificationType,
  patch: { inApp?: boolean; email?: boolean },
): Promise<void> {
  await db.notificationPreference.upsert({
    where: { userId_type: { userId: actor.id, type } },
    create: {
      userId: actor.id,
      type,
      inApp: patch.inApp ?? true,
      email: patch.email ?? false,
    },
    update: {
      ...(patch.inApp === undefined ? {} : { inApp: patch.inApp }),
      ...(patch.email === undefined ? {} : { email: patch.email }),
    },
  });
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod = n % 100;
  return `${n}${suffixes[(mod - 20) % 10] ?? suffixes[mod] ?? suffixes[0]}`;
}

/**
 * Creates every notification the organization is due today, and nothing it has
 * already had.
 *
 * Idempotent by design: the job may be retried, run twice by two servers, or
 * re-run after a crash. Dedupe is on (userId, type, link) within the day, so
 * every rule that can fire more than once a day — a goal deadline, a
 * leaderboard move, an achievement — carries the entity in its link.
 *
 * `asOf` is the day the sweep is *for*, not the wall clock; it exists so the
 * job can be back-filled and tested.
 */
export async function runNotificationSweep(
  organizationId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const day = dayKey(asOf);
  const tomorrow = addDays(day, 1);
  const yesterday = addDays(day, -1);
  const deadlineHorizon = addDays(day, 8);

  const users = await db.user.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, joinedAt: true },
  });
  if (users.length === 0) return 0;

  const userIds = users.map((u) => u.id);

  const [
    activeTaskCount,
    doneToday,
    doneYesterday,
    checkedInToday,
    dueGoals,
    ranks,
    already,
  ] = await Promise.all([
    db.coreTask.count({ where: { organizationId, isActive: true } }),
    db.coreTaskCompletion.findMany({
      where: { userId: { in: userIds }, date: day, completed: true },
      select: { userId: true, coreTaskId: true },
    }),
    db.coreTaskCompletion.findMany({
      where: { userId: { in: userIds }, date: yesterday, completed: true },
      select: { userId: true },
    }),
    db.dailyCheckIn.findMany({
      where: { userId: { in: userIds }, date: day },
      select: { userId: true },
    }),
    db.goal.findMany({
      where: {
        userId: { in: userIds },
        status: { notIn: ["COMPLETED", "ABANDONED"] },
        targetDate: { lt: deadlineHorizon },
      },
      select: { id: true, userId: true, title: true, targetDate: true },
    }),
    db.leaderboardEntry.findMany({
      where: { userId: { in: userIds } },
      orderBy: { capturedAt: "desc" },
      select: { userId: true, board: true, scopeId: true, rank: true },
    }),
    db.notification.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: day, lt: tomorrow } },
      select: { userId: true, type: true, link: true },
    }),
  ]);

  // --- bucket the raw rows ------------------------------------------------

  const tasksDoneToday = new Map<string, Set<string>>();
  for (const row of doneToday) {
    const set = tasksDoneToday.get(row.userId) ?? new Set<string>();
    set.add(row.coreTaskId);
    tasksDoneToday.set(row.userId, set);
  }

  const workedYesterday = new Set(doneYesterday.map((r) => r.userId));
  const checkedIn = new Set(checkedInToday.map((r) => r.userId));

  const goalsByUser = new Map<string, typeof dueGoals>();
  for (const goal of dueGoals) {
    const list = goalsByUser.get(goal.userId) ?? [];
    list.push(goal);
    goalsByUser.set(goal.userId, list);
  }

  // Rows arrive newest-first, so the first two per (user, board, scope) are the
  // two most recent captures — [latest, previous].
  const rankHistory = new Map<
    string,
    { userId: string; board: string; ranks: number[] }
  >();
  for (const row of ranks) {
    const key = `${row.userId}|${row.board}|${row.scopeId}`;
    const entry = rankHistory.get(key) ?? {
      userId: row.userId,
      board: row.board,
      ranks: [],
    };
    if (entry.ranks.length < 2) entry.ranks.push(row.rank);
    rankHistory.set(key, entry);
  }

  const seen = new Set(
    already.map((n) => `${n.userId}|${n.type}|${n.link ?? ""}`),
  );

  let created = 0;

  const emit = async (input: NotifyInput): Promise<void> => {
    const link = input.link ?? null;
    const key = `${input.userId}|${input.type}|${link ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (await deliver({ ...input, link })) created += 1;
  };

  // --- per-user rules -----------------------------------------------------

  for (const user of users) {
    // CORE_TASK_REMINDER — today's disciplines are not finished.
    const done = tasksDoneToday.get(user.id)?.size ?? 0;
    const remaining = activeTaskCount - done;
    if (activeTaskCount > 0 && remaining > 0) {
      await emit({
        userId: user.id,
        type: "CORE_TASK_REMINDER",
        title: `${remaining} core ${remaining === 1 ? "task" : "tasks"} left today`,
        body: "Finish today's core tasks to keep your streak alive.",
        link: "/core-tasks",
      });
    }

    // MISSED_TASK — a completely blank yesterday. Skipped for anyone who had
    // not joined yet, so a new member is never scolded for a day they missed by
    // not existing.
    const joinedBeforeYesterday = dayKey(user.joinedAt) <= yesterday;
    if (
      activeTaskCount > 0 &&
      joinedBeforeYesterday &&
      !workedYesterday.has(user.id)
    ) {
      await emit({
        userId: user.id,
        type: "MISSED_TASK",
        title: "You missed every core task yesterday",
        body: "Yesterday closed with no core tasks completed. Start today fresh.",
        link: "/core-tasks",
        priority: "HIGH",
      });
    }

    // GOAL_DEADLINE — the link carries the goal id, so two goals falling due on
    // the same day both get past the dedupe.
    for (const goal of goalsByUser.get(user.id) ?? []) {
      const days = daysUntil(goal.targetDate, day);
      const overdue = days < 0;
      const late = Math.abs(days);

      const title = overdue
        ? `${goal.title} is overdue`
        : days === 0
          ? `${goal.title} is due today`
          : `${goal.title} is due in ${days} ${days === 1 ? "day" : "days"}`;

      await emit({
        userId: user.id,
        type: "GOAL_DEADLINE",
        title,
        body: overdue
          ? `This goal passed its target date ${late} ${late === 1 ? "day" : "days"} ago.`
          : "Update your progress, or move the target date.",
        link: `/goals/${goal.id}`,
        priority: overdue ? "HIGH" : "NORMAL",
      });
    }

    // CHECK_IN_REMINDER
    if (!checkedIn.has(user.id)) {
      await emit({
        userId: user.id,
        type: "CHECK_IN_REMINDER",
        title: "Your daily check-in is waiting",
        body: "Two minutes on wins, challenges and tomorrow's focus.",
        link: "/check-in",
      });
    }
  }

  // LEADERBOARD_CHANGE — a rank improves when the number gets smaller.
  for (const entry of rankHistory.values()) {
    const [latest, previous] = entry.ranks;
    if (latest === undefined || previous === undefined) continue;
    if (latest >= previous) continue;

    const board = asBoard(entry.board);
    await emit({
      userId: entry.userId,
      type: "LEADERBOARD_CHANGE",
      title: `You climbed to ${ordinal(latest)} on the ${LEADERBOARD_LABELS[board]} leaderboard`,
      body: `Up from ${ordinal(previous)}. Keep going.`,
      link: `/leaderboards?board=${board}`,
    });
  }

  // ACHIEVEMENT_UNLOCKED — checkAchievements is itself idempotent, so it only
  // ever hands back badges unlocked by this run.
  for (const user of users) {
    for (const def of await checkAchievements(user.id)) {
      await emit({
        userId: user.id,
        type: "ACHIEVEMENT_UNLOCKED",
        title: `Achievement unlocked: ${def.name}`,
        body: def.description,
        link: `/achievements#${def.key}`,
      });
    }
  }

  return created;
}
