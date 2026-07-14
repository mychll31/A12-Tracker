import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  ForbiddenError,
  assertCanEditMentee,
  assertCanViewUser,
  coachMenteeIds,
} from "@/lib/rbac";
import { addDays, dayKey, isoDay, lastNDays, today } from "@/lib/dates";
import { syncStreak } from "@/lib/scoring";
import { logActivity } from "@/server/activity";

/**
 * The daily check-in — wins, challenges, lessons, gratitude, tomorrow's focus.
 *
 * One row per person per day, keyed on the same UTC day bucket as every other
 * daily record, so re-opening today's form edits today's entry instead of
 * stacking a second one behind it.
 */

export type CheckInReviewItem = {
  id: string;
  comment: string;
  createdAt: Date;
  coach: { firstName: string; lastName: string; avatarUrl: string | null };
};

export type CheckInDetail = {
  id: string;
  date: Date;
  wins: string | null;
  challenges: string | null;
  lessons: string | null;
  gratitude: string | null;
  tomorrowFocus: string | null;
  mood: number;
  reviews: CheckInReviewItem[];
};

export type CheckInStreakDay = {
  date: string;
  mood: number | null;
  hasCheckIn: boolean;
};

const MOOD_MIN = 1;
const MOOD_MAX = 5;
const REVIEW_WINDOW_DAYS = 7;
const DEFAULT_LIST_LIMIT = 30;

const clampMood = (mood: number) =>
  Math.min(MOOD_MAX, Math.max(MOOD_MIN, Math.round(mood)));

const reviewInclude = {
  orderBy: { createdAt: "asc" },
  include: {
    coach: { select: { firstName: true, lastName: true, avatarUrl: true } },
  },
} as const;

type CheckInRow = {
  id: string;
  date: Date;
  wins: string | null;
  challenges: string | null;
  lessons: string | null;
  gratitude: string | null;
  tomorrowFocus: string | null;
  mood: number;
  reviews: {
    id: string;
    comment: string;
    createdAt: Date;
    coach: { firstName: string; lastName: string; avatarUrl: string | null };
  }[];
};

function toDetail(row: CheckInRow): CheckInDetail {
  return {
    id: row.id,
    date: row.date,
    wins: row.wins,
    challenges: row.challenges,
    lessons: row.lessons,
    gratitude: row.gratitude,
    tomorrowFocus: row.tomorrowFocus,
    mood: row.mood,
    reviews: row.reviews.map((r) => ({
      id: r.id,
      comment: r.comment,
      createdAt: r.createdAt,
      coach: r.coach,
    })),
  };
}

export async function getCheckIn(
  actor: SessionUser,
  userId: string,
  date: Date = today(),
): Promise<CheckInDetail | null> {
  await assertCanViewUser(actor, userId);

  const row = await db.dailyCheckIn.findUnique({
    where: { userId_date: { userId, date: dayKey(date) } },
    include: { reviews: reviewInclude },
  });

  return row ? toDetail(row) : null;
}

export async function upsertCheckIn(
  actor: SessionUser,
  input: {
    userId: string;
    date?: Date;
    wins?: string;
    challenges?: string;
    lessons?: string;
    gratitude?: string;
    tomorrowFocus?: string;
    mood: number;
  },
): Promise<string> {
  await assertCanEditMentee(actor, input.userId);

  const day = dayKey(input.date ?? today());
  const mood = clampMood(input.mood);

  const fields = {
    wins: input.wins ?? null,
    challenges: input.challenges ?? null,
    lessons: input.lessons ?? null,
    gratitude: input.gratitude ?? null,
    tomorrowFocus: input.tomorrowFocus ?? null,
    mood,
  };

  const checkIn = await db.dailyCheckIn.upsert({
    where: { userId_date: { userId: input.userId, date: day } },
    create: { userId: input.userId, date: day, ...fields },
    update: fields,
    select: { id: true },
  });

  await logActivity({
    userId: input.userId,
    actorId: actor.id,
    type: "CHECK_IN_SUBMITTED",
    entityType: "checkIn",
    entityId: checkIn.id,
    summary: "Filed a daily check-in",
    metadata: { mood, date: isoDay(day) },
  });

  await syncStreak(input.userId);

  return checkIn.id;
}

export async function listCheckIns(
  actor: SessionUser,
  userId: string,
  limit: number = DEFAULT_LIST_LIMIT,
): Promise<CheckInDetail[]> {
  await assertCanViewUser(actor, userId);

  const rows = await db.dailyCheckIn.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit,
    include: { reviews: reviewInclude },
  });

  return rows.map(toDetail);
}

export async function reviewCheckIn(
  actor: SessionUser,
  checkInId: string,
  comment: string,
): Promise<void> {
  // Reviewing is a coaching act, not an edit: any coach who can see the mentee
  // may respond, without holding a delegation to edit them.
  if (!actor.isCoach && !actor.isAdmin) {
    throw new ForbiddenError("Only coaches can review a check-in.");
  }

  const checkIn = await db.dailyCheckIn.findUnique({
    where: { id: checkInId },
    select: { id: true, userId: true, date: true },
  });
  if (!checkIn) throw new ForbiddenError("That check-in no longer exists.");

  await assertCanViewUser(actor, checkIn.userId);

  await db.checkInReview.create({
    data: { checkInId, coachId: actor.id, comment },
  });

  await logActivity({
    userId: checkIn.userId,
    actorId: actor.id,
    type: "COMMENT_ADDED",
    entityType: "checkIn",
    entityId: checkInId,
    summary: `${actor.fullName} reviewed a daily check-in`,
    metadata: { date: isoDay(checkIn.date) },
  });

  await db.notification.create({
    data: {
      userId: checkIn.userId,
      type: "COACH_FEEDBACK",
      title: "Your coach reviewed your check-in",
      body: `${actor.fullName} left feedback on your check-in.`,
      link: `/check-ins/${checkInId}`,
      priority: "NORMAL",
    },
  });
}

export async function checkInStreak(
  actor: SessionUser,
  userId: string,
  days: number,
): Promise<CheckInStreakDay[]> {
  await assertCanViewUser(actor, userId);

  const window = lastNDays(days);
  const start = window[0];
  const end = window[window.length - 1];

  const rows = await db.dailyCheckIn.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { date: true, mood: true },
  });

  const byDay = new Map(rows.map((r) => [isoDay(r.date), r.mood]));

  // Days without a check-in stay in the series as explicit blanks, so the mood
  // strip shows the gaps rather than closing over them.
  return window.map((day) => {
    const key = isoDay(day);
    const mood = byDay.get(key);
    return { date: key, mood: mood ?? null, hasCheckIn: mood !== undefined };
  });
}

export async function pendingReviewCount(coachId: string): Promise<number> {
  const menteeIds = await coachMenteeIds(coachId);
  if (!menteeIds.length) return 0;

  const since = addDays(today(), -(REVIEW_WINDOW_DAYS - 1));

  // "Pending" is per-coach: a colleague's review does not clear the check-in
  // from this coach's queue.
  return db.dailyCheckIn.count({
    where: {
      userId: { in: menteeIds },
      date: { gte: since },
      reviews: { none: { coachId } },
    },
  });
}
