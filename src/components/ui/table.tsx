import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Styles the scroll container rather than the <table> itself. */
  wrapperClassName?: string;
}

export type THeadProps = HTMLAttributes<HTMLTableSectionElement>;
export type TBodyProps = HTMLAttributes<HTMLTableSectionElement>;
export type TRProps = HTMLAttributes<HTMLTableRowElement>;
export type THProps = ThHTMLAttributes<HTMLTableCellElement>;
export type TDProps = TdHTMLAttributes<HTMLTableCellElement>;

export function Table({ className, wrapperClassName, ...props }: TableProps) {
  return (
    // A table row has a floor width; on a phone it must scroll sideways rather
    // than wrap into an unreadable stack.
    <div
      className={cn(
        "scroll-thin w-full overflow-x-auto rounded-card border border-border",
        wrapperClassName,
      )}
    >
      <table
        className={cn("w-full min-w-max border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({ className, ...props }: THeadProps) {
  return (
    <thead className={cn("bg-surface-sunken text-left", className)} {...props} />
  );
}

export function TBody({ className, ...props }: TBodyProps) {
  return (
    <tbody
      className={cn(
        "divide-y divide-border bg-surface-raised [&_tr:last-child]:border-0",
        className,
      )}
      {...props}
    />
  );
}

export function TR({ className, ...props }: TRProps) {
  return (
    <tr
      className={cn("transition-colors hover:bg-surface-sunken/60", className)}
      {...props}
    />
  );
}

export function TH({ className, scope = "col", ...props }: THProps) {
  return (
    <th
      scope={scope}
      className={cn(
        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TDProps) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-foreground", className)}
      {...props}
    />
  );
}
