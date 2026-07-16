import { rankForPercent, type GoalRankKey } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * The illustrated rank medal — the sprite emblem for a score's tier, from Herald
 * (0–10%) to Titan (90–100%). Used wherever a person's standing is shown at a
 * glance: the dashboard, the mentee cards and the leaderboards.
 *
 * `null` is a withdrawn/abandoned score, which earns no rank and renders nothing.
 * (Distinct from `GoalRankMedal`, the compact text badge on a single goal, and
 * from the leaderboard's own position medal.)
 */
const RANK_SRC: Record<GoalRankKey, string> = {
  HERALD: "/ranks/herald.png",
  GUARDIAN: "/ranks/guardian.png",
  CRUSADER: "/ranks/crusader.png",
  ARCHON: "/ranks/archon.png",
  LEGEND: "/ranks/legend.png",
  ANCIENT: "/ranks/ancient.png",
  DIVINE: "/ranks/divine.png",
  IMMORTAL: "/ranks/immortal.png",
  MASTER_IMMORTAL: "/ranks/master_immortal.png",
  TITAN: "/ranks/titan.png",
};

/** Per-tier text colour, matching the goal rank badge's cool→warm ramp. */
export const RANK_TEXT: Record<GoalRankKey, string> = {
  HERALD: "text-slate-500 dark:text-slate-300",
  GUARDIAN: "text-emerald-600 dark:text-emerald-400",
  CRUSADER: "text-teal-600 dark:text-teal-400",
  ARCHON: "text-sky-600 dark:text-sky-400",
  LEGEND: "text-blue-600 dark:text-blue-400",
  ANCIENT: "text-indigo-600 dark:text-indigo-400",
  DIVINE: "text-violet-600 dark:text-violet-400",
  IMMORTAL: "text-fuchsia-600 dark:text-fuchsia-400",
  MASTER_IMMORTAL: "text-amber-600 dark:text-amber-400",
  TITAN: "text-rose-600 dark:text-rose-400",
};

/** Per-tier progress-bar fill colour. */
export const RANK_BAR: Record<GoalRankKey, string> = {
  HERALD: "bg-slate-400",
  GUARDIAN: "bg-emerald-500",
  CRUSADER: "bg-teal-500",
  ARCHON: "bg-sky-500",
  LEGEND: "bg-blue-500",
  ANCIENT: "bg-indigo-500",
  DIVINE: "bg-violet-500",
  IMMORTAL: "bg-fuchsia-500",
  MASTER_IMMORTAL: "bg-amber-500",
  TITAN: "bg-rose-500",
};

export function RankMedalImage({
  score,
  size = 40,
  className,
}: {
  /** A 0–100 score/percentage, or `null` for an unranked (abandoned) value. */
  score: number | null;
  /** Rendered height in px; width follows the emblem's aspect ratio. */
  size?: number;
  className?: string;
}) {
  if (score === null) return null;

  const rank = rankForPercent(score);

  return (
    // Local static emblem from /public — a plain <img> is the right trade here,
    // exactly as the Avatar does for its images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={RANK_SRC[rank.key]}
      alt={`${rank.name} rank`}
      title={`${rank.name} — ${rank.min}–${rank.max}%`}
      className={cn("shrink-0 object-contain", className)}
      style={{ height: size, width: "auto" }}
      loading="lazy"
      decoding="async"
    />
  );
}
