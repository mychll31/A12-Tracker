import { Medal } from "lucide-react";

import { Badge } from "@/components/ui";
import { rankForPercent, type GoalRankKey } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * A goal's rank medal: its completion percentage placed on a ten-rung ladder,
 * from Herald (0–10%) up to Titan (90–100%). It sits beside the score — the
 * score stays the precise number, the medal is the flavour.
 *
 * `null` is an ABANDONED goal — withdrawn from scoring — so it earns no rank and
 * renders nothing, matching the "—" its score badge already shows.
 *
 * (Named `GoalRankMedal`, not `RankMedal`, to stay clear of the leaderboard's
 * own file-local `RankMedal`, which is a finishing *position*, not a tier.)
 */
const RANK_STYLE: Record<GoalRankKey, string> = {
  HERALD: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
  GUARDIAN:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  CRUSADER: "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-400",
  ARCHON: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  LEGEND: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400",
  ANCIENT:
    "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400",
  DIVINE:
    "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  IMMORTAL:
    "bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/20 dark:text-fuchsia-400",
  MASTER_IMMORTAL:
    "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  TITAN:
    "bg-rose-500/10 text-rose-600 ring-rose-500/20 shadow-[0_0_10px_-2px_rgba(244,63,94,0.5)] dark:text-rose-400",
};

export function GoalRankMedal({
  score,
  size = "sm",
  showName = true,
  className,
}: {
  /** The goal's completion percentage (0–100), or `null` when abandoned. */
  score: number | null;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}) {
  if (score === null) return null;

  const rank = rankForPercent(score);

  return (
    <Badge
      size={size}
      className={cn(RANK_STYLE[rank.key], className)}
      title={`${rank.name} — ${rank.min}–${rank.max}% complete`}
    >
      <Medal aria-hidden />
      {showName ? rank.name : null}
    </Badge>
  );
}
