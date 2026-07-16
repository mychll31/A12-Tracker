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

/*
 * The score palette is the landing page's, not Tailwind's: green, cyan, gold and
 * rose — the same four hues its "Your Total Score" card uses for 100 / 33.3 / 25.
 * They resolve through CSS variables (globals.css), so a 72 is the same colour in
 * a ring, a bar, a badge and a chart, and both themes stay in step on their own.
 */
export const TONE_TEXT: Record<Tone, string> = {
  critical: "text-[color:var(--score-critical)]",
  warning: "text-[color:var(--score-warning)]",
  good: "text-[color:var(--score-good)]",
  excellent: "text-[color:var(--score-excellent)]",
};

export const TONE_BG: Record<Tone, string> = {
  critical: "bg-[color:var(--score-critical)]",
  warning: "bg-[color:var(--score-warning)]",
  good: "bg-[color:var(--score-good)]",
  excellent: "bg-[color:var(--score-excellent)]",
};

export const TONE_SOFT: Record<Tone, string> = {
  critical:
    "bg-[color:var(--score-critical)]/10 text-[color:var(--score-critical)] ring-[color:var(--score-critical)]/25",
  warning:
    "bg-[color:var(--score-warning)]/10 text-[color:var(--score-warning)] ring-[color:var(--score-warning)]/25",
  good: "bg-[color:var(--score-good)]/10 text-[color:var(--score-good)] ring-[color:var(--score-good)]/25",
  excellent:
    "bg-[color:var(--score-excellent)]/10 text-[color:var(--score-excellent)] ring-[color:var(--score-excellent)]/25",
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
