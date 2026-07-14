import { Badge } from "@/components/ui";
import { cn, formatScore, scoreTone, TONE_SOFT } from "@/lib/utils";

/**
 * A goal's own score: the weighted share of its tasks that are done, 0-100.
 *
 * `null` is an ABANDONED goal — withdrawn from every average rather than scored
 * zero — so it must read as "—", never as a 0 the mentee never earned.
 */
export function GoalScoreBadge({
  score,
  size = "sm",
  className,
}: {
  score: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (score === null) {
    return (
      <Badge size={size} variant="neutral" className={className}>
        Score —
      </Badge>
    );
  }

  return (
    <Badge size={size} className={cn(TONE_SOFT[scoreTone(score)], className)}>
      Score {formatScore(score)}
    </Badge>
  );
}
