/**
 * Every daily record in Abundance Hub — a core-task completion, a check-in, a
 * score snapshot — is keyed to a "day bucket": midnight UTC of that calendar
 * day. Keying on UTC rather than local time is what keeps the daily uniqueness
 * constraints and the streak arithmetic stable no matter where the server runs.
 */

const MS_PER_DAY = 86_400_000;

/** Midnight UTC of the day the given instant falls on. */
export function dayKey(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function today(): Date {
  return dayKey(new Date());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days from `from` to `to`. Both are bucketed first, so it never returns a fraction. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (dayKey(to).getTime() - dayKey(from).getTime()) / MS_PER_DAY,
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a).getTime() === dayKey(b).getTime();
}

/**
 * The inclusive list of day buckets in a window ending today.
 * `lastNDays(30)` yields 30 entries, oldest first, the last being today.
 */
export function lastNDays(n: number, end: Date = new Date()): Date[] {
  const last = dayKey(end);
  return Array.from({ length: n }, (_, i) => addDays(last, i - (n - 1)));
}

/** The window a trailing-N-day metric covers, clamped so it never predates the user joining. */
export function scoringWindow(
  windowDays: number,
  joinedAt: Date,
  end: Date = new Date(),
): { start: Date; end: Date; days: number } {
  const endKey = dayKey(end);
  const naiveStart = addDays(endKey, -(windowDays - 1));
  const joinKey = dayKey(joinedAt);
  const start = joinKey > naiveStart ? joinKey : naiveStart;
  return { start, end: endKey, days: daysBetween(start, endKey) + 1 };
}

/** Stable `YYYY-MM-DD` key — used for grouping and as a React list key. */
export function isoDay(date: Date): string {
  return dayKey(date).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3 days ago", "in 2 weeks" — for activity feeds and deadlines. */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffDays = daysBetween(now, date);
  const abs = Math.abs(diffDays);

  if (abs === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";

  const [divisor, unit]: [number, Intl.RelativeTimeFormatUnit] =
    abs < 7
      ? [1, "day"]
      : abs < 30
        ? [7, "week"]
        : abs < 365
          ? [30, "month"]
          : [365, "year"];

  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  return rtf.format(Math.round(diffDays / divisor), unit);
}

/** Negative when overdue. Drives goal-deadline notifications and badges. */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return daysBetween(now, target);
}
