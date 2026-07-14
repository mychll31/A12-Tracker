"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

const SIDES: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

/**
 * Opens on hover *and* focus — a tooltip reachable only by pointer is invisible
 * to keyboard users. The trigger is a focusable span, so the tip still works
 * when it wraps inert content such as an icon or a bare number.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <span
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {children}
      </span>

      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "animate-fade-in card-shadow pointer-events-none absolute z-50",
            "whitespace-nowrap rounded-lg border border-border bg-surface-raised",
            "px-2.5 py-1.5 text-xs font-medium text-foreground",
            SIDES[side],
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
