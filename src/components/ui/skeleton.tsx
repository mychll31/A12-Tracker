import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      // The loading surface as a whole is announced by its container, so each
      // individual bar stays out of the accessibility tree.
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-sunken", className)}
      {...props}
    />
  );
}

export interface SkeletonCardProps {
  /** Placeholder body lines rendered under the title block. */
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <Card
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn("p-5 sm:p-6", className)}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3"
            // Ragged line lengths read as prose; uniform ones read as a table.
            style={{ width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    </Card>
  );
}
