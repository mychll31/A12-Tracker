import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { assertCanEditMentee, assertCanViewUser } from "@/lib/rbac";
import { dayKey, isoDay, lastNDays, today } from "@/lib/dates";
import { syncStreak } from "@/lib/scoring";
import { logActivity } from "@/server/activity";

/**
 * Core tasks — the daily disciplines.
 *
 * A completion row exists only for a day a task was actually done. That is the
 * whole storage model: absence of a row is what "missed" means, so nothing has
 * to back-fill tombstones for every user, for every task, for every day.
 */

export type TaskBoardItem = {
  taskId: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  points: number;
  completed: boolean;
  notes: string | null;
  completionId: string | null;
};

export type TaskBoard = {
  date: Date;
  items: TaskBoardItem[];
  completedCount: number;
  total: number;
  percent: number;
};

export type TaskHistoryDay = {
  date: string;
  completed: number;
  total: number;
  percent: number;
};

export type TaskBreakdownRow = {
  key: string;
  name: string;
  completed: number;
  possible: number;
  percent: number;
};

const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

export async function listCoreTasks(organizationId: string) {
  return db.coreTask.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });
}

/** The tasks a user is measured against come from their org, not the actor's. */
async function tasksForUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user) return [];
  return listCoreTasks(user.organizationId);
}

export async function getTaskBoard(
  actor: SessionUser,
  userId: string,
  date: Date = today(),
): Promise<TaskBoard> {
  await assertCanViewUser(actor, userId);

  const day = dayKey(date);
  const [tasks, completions] = await Promise.all([
    tasksForUser(userId),
    db.coreTaskCompletion.findMany({
      where: { userId, date: day, completed: true },
    }),
  ]);

  const byTask = new Map(completions.map((c) => [c.coreTaskId, c]));

  const items: TaskBoardItem[] = tasks.map((task) => {
    const completion = byTask.get(task.id);
    return {
      taskId: task.id,
      key: task.key,
      name: task.name,
      description: task.description,
      icon: task.icon,
      points: task.points,
      completed: Boolean(completion),
      notes: completion?.notes ?? null,
      completionId: completion?.id ?? null,
    };
  });

  const completedCount = items.filter((i) => i.completed).length;

  return {
    date: day,
    items,
    completedCount,
    total: items.length,
    percent: percentOf(completedCount, items.length),
  };
}

export async function toggleCoreTask(
  actor: SessionUser,
  input: {
    userId: string;
    coreTaskId: string;
    date: Date;
    completed: boolean;
    notes?: string;
  },
): Promise<void> {
  await assertCanEditMentee(actor, input.userId);

  const day = dayKey(input.date);

  if (!input.completed) {
    // Un-ticking deletes the row. A `completed: false` row would be a tombstone
    // every "missed day" query would then have to learn to ignore.
    await db.coreTaskCompletion.deleteMany({
      where: { userId: input.userId, coreTaskId: input.coreTaskId, date: day },
    });
    await syncStreak(input.userId);
    return;
  }

  await db.coreTaskCompletion.upsert({
    where: {
      userId_coreTaskId_date: {
        userId: input.userId,
        coreTaskId: input.coreTaskId,
        date: day,
      },
    },
    create: {
      userId: input.userId,
      coreTaskId: input.coreTaskId,
      date: day,
      completed: true,
      notes: input.notes ?? null,
    },
    update: {
      completed: true,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      completedAt: new Date(),
    },
  });

  const task = await db.coreTask.findUnique({
    where: { id: input.coreTaskId },
    select: { key: true, name: true, points: true },
  });

  await logActivity({
    userId: input.userId,
    actorId: actor.id,
    type: "TASK_COMPLETED",
    entityType: "coreTask",
    entityId: input.coreTaskId,
    summary: `Completed the core task "${task?.name ?? "core task"}"`,
    metadata: {
      taskKey: task?.key ?? null,
      points: task?.points ?? 0,
      date: isoDay(day),
    },
  });

  await syncStreak(input.userId);
}

export async function taskHistory(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<TaskHistoryDay[]> {
  await assertCanViewUser(actor, userId);

  const window = lastNDays(days);
  const start = window[0];
  const end = window[window.length - 1];

  const [tasks, completions] = await Promise.all([
    tasksForUser(userId),
    db.coreTaskCompletion.findMany({
      where: { userId, completed: true, date: { gte: start, lte: end } },
      select: { date: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const c of completions) {
    const key = isoDay(c.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Every day in the window gets a row, including the empty ones — a missed day
  // has to render as a gap in the chart, not vanish from the axis.
  return window.map((day) => {
    const key = isoDay(day);
    const completed = counts.get(key) ?? 0;
    return {
      date: key,
      completed,
      total: tasks.length,
      percent: percentOf(completed, tasks.length),
    };
  });
}

export async function missedDays(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<string[]> {
  const history = await taskHistory(actor, userId, days);
  return history.filter((d) => d.completed === 0).map((d) => d.date);
}

export async function taskBreakdown(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<TaskBreakdownRow[]> {
  await assertCanViewUser(actor, userId);

  const window = lastNDays(days);
  const start = window[0];
  const end = window[window.length - 1];

  const [tasks, completions] = await Promise.all([
    tasksForUser(userId),
    db.coreTaskCompletion.findMany({
      where: { userId, completed: true, date: { gte: start, lte: end } },
      select: { coreTaskId: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const c of completions) {
    counts.set(c.coreTaskId, (counts.get(c.coreTaskId) ?? 0) + 1);
  }

  const possible = window.length;

  return tasks.map((task) => {
    const completed = counts.get(task.id) ?? 0;
    return {
      key: task.key,
      name: task.name,
      completed,
      possible,
      percent: percentOf(completed, possible),
    };
  });
}
