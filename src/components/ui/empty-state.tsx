import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** A lucide-react icon *component* (e.g. `Target`), not an element. */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "animate-fade-in flex flex-col items-center justify-center text-center",
        "rounded-card border border-dashed border-border bg-surface-raised",
        "px-6 py-12 sm:py-16",
        className,
      )}
    >
      {Icon ? (
        <div
          className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-sunken"
          aria-hidden="true"
        >
          <Icon className="size-5 text-muted" />
        </div>
      ) : null}

      <h3 className="text-sm font-semibold text-foreground">{title}</h3>

      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
