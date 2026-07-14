import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { GOAL_STATUS_LABELS, type GoalStatus } from "@/lib/domain";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-sunken text-muted-strong ring-border",
  primary: "bg-primary-soft text-primary ring-primary/20",
  success:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "h-5 gap-1 px-2 text-[0.6875rem] [&_svg]:size-3",
  md: "h-6 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5",
};

export function Badge({
  variant = "neutral",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full font-medium",
        "ring-1 ring-inset [&_svg]:shrink-0",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/** One status, one colour — everywhere a goal's state is shown. */
const STATUS_VARIANTS: Record<GoalStatus, BadgeVariant> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  AT_RISK: "warning",
  COMPLETED: "success",
  ABANDONED: "danger",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: GoalStatus;
}

export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} {...props}>
      {GOAL_STATUS_LABELS[status]}
    </Badge>
  );
}
