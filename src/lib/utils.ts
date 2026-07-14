import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes so a caller's class always wins over a component default. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Scores are stored to one decimal; whole numbers read better in dense UI. */
export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export type Tone = "critical" | "warning" | "good" | "excellent";

/**
 * The single place a 0-100 score becomes a colour. Every ring, bar, badge and
 * leaderboard row reads from here, so "72" is the same shade wherever it appears.
 */
export function scoreTone(score: number): Tone {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

export const TONE_TEXT: Record<Tone, string> = {
  critical: "text-rose-500 dark:text-rose-400",
  warning: "text-amber-500 dark:text-amber-400",
  good: "text-sky-500 dark:text-sky-400",
  excellent: "text-emerald-500 dark:text-emerald-400",
};

export const TONE_BG: Record<Tone, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  good: "bg-sky-500",
  excellent: "bg-emerald-500",
};

export const TONE_SOFT: Record<Tone, string> = {
  critical: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  good: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  excellent:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
};

/** Ordinal rank for leaderboards: 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Strip tags from rich-text note bodies for previews and search. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
