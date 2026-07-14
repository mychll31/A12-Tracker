import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardProps = HTMLAttributes<HTMLDivElement>;
export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;
export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
};
export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;
export type CardContentProps = HTMLAttributes<HTMLDivElement>;
export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface-raised border border-border rounded-card card-shadow",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-1 p-5 pb-0 sm:p-6 sm:pb-0", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, as = "h3", ...props }: CardTitleProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-border px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}
