import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, TONE_TEXT, type Tone } from "@/lib/utils";
import { Card } from "./card";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** A lucide-react icon *component* (e.g. `Flame`), not an element. */
  icon?: ComponentType<{ className?: string }>;
  /** Signed change: positive renders green with an up arrow, negative red with a down arrow. */
  delta?: number;
  deltaLabel?: string;
  /** Tints the value. Omit to leave it neutral foreground. */
  tone?: Tone;
  /** Turns the whole card into a link. */
  href?: string;
  className?: string;
}

const SHELL = "block p-5";
const INTERACTIVE =
  "transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  tone,
  href,
  className,
}: StatCardProps) {
  // Zero is neither good nor bad news, so it gets no arrow and no colour.
  const rising = delta !== undefined && delta > 0;
  const falling = delta !== undefined && delta < 0;
  const DeltaIcon = rising ? ArrowUpRight : ArrowDownRight;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        {Icon ? (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken"
            aria-hidden="true"
          >
            <Icon className="size-4 text-muted-strong" />
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight tabular-nums",
          tone ? TONE_TEXT[tone] : "text-foreground",
        )}
      >
        {value}
      </p>

      {delta !== undefined ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold tabular-nums",
              rising && "text-emerald-500 dark:text-emerald-400",
              falling && "text-rose-500 dark:text-rose-400",
              !rising && !falling && "text-muted",
            )}
          >
            {rising || falling ? (
              <DeltaIcon className="size-3.5" aria-hidden="true" />
            ) : null}
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
          {deltaLabel ? (
            <span className="truncate text-muted">{deltaLabel}</span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "bg-surface-raised border border-border rounded-card card-shadow",
          SHELL,
          INTERACTIVE,
          className,
        )}
      >
        {body}
      </Link>
    );
  }

  return <Card className={cn(SHELL, className)}>{body}</Card>;
}
