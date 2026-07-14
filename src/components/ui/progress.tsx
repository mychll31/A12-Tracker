import {
  cn,
  formatScore,
  scoreTone,
  TONE_BG,
  TONE_TEXT,
  type Tone,
} from "@/lib/utils";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export interface ProgressBarProps {
  /** 0-100. Out-of-range values are clamped rather than overflowing the track. */
  value: number;
  label?: string;
  /** Defaults to `scoreTone(value)`, so bars match rings and badges. */
  tone?: Tone;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({
  value,
  label,
  tone,
  showValue = true,
  size = "md",
  className,
}: ProgressBarProps) {
  const pct = clamp(value);
  const resolved = tone ?? scoreTone(pct);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <span className="text-xs font-medium text-muted-strong">
              {label}
            </span>
          ) : null}
          {showValue ? (
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                TONE_TEXT[resolved],
              )}
            >
              {formatScore(pct)}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className={cn(
          "w-full overflow-hidden rounded-full bg-surface-sunken",
          size === "sm" ? "h-1.5" : "h-2",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            TONE_BG[resolved],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export interface ScoreRingProps {
  /** 0-100. */
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  tone?: Tone;
  className?: string;
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  tone,
  className,
}: ScoreRingProps) {
  const pct = clamp(score);
  const resolved = tone ?? scoreTone(pct);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}${formatScore(pct)} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // The geometry is decorative; the accessible name lives on the wrapper.
        aria-hidden="true"
        // -90deg puts 0% at 12 o'clock, where a progress dial is read from.
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-sunken"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            TONE_TEXT[resolved],
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className={cn(
            "font-semibold leading-none tracking-tight tabular-nums",
            TONE_TEXT[resolved],
          )}
          style={{ fontSize: Math.max(14, size * 0.24) }}
        >
          {formatScore(pct)}
        </span>
        {sublabel ? (
          <span className="text-[0.6875rem] font-medium text-muted">
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
