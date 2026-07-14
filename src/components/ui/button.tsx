import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover active:brightness-95",
  secondary:
    "bg-surface-sunken text-foreground hover:bg-border/60 active:bg-border",
  ghost:
    "bg-transparent text-muted-strong hover:bg-surface-sunken hover:text-foreground",
  danger: "bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700",
  outline:
    "bg-transparent text-foreground border border-border-strong hover:bg-surface-sunken",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg [&_svg]:size-3.5",
  md: "h-10 px-4 text-sm gap-2 rounded-xl [&_svg]:size-4",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl [&_svg]:size-[1.125rem]",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // Callers shouldn't have to remember to pass `disabled` alongside
      // `isLoading` — a button mid-request must never be clickable twice.
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-colors duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:shrink-0",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
