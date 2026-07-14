import { Children, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export interface AvatarProps {
  src?: string | null;
  firstName: string;
  lastName: string;
  size?: AvatarSize;
  className?: string;
}

const SIZES: Record<AvatarSize, string> = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

/**
 * Fallback tints. Drawn from hues the score tones don't use, so a wall of
 * avatars never reads as if it were encoding performance.
 */
const TINTS = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "bg-pink-500/15 text-pink-600 dark:text-pink-300",
] as const;

/** Same name, same colour — on every render, and identically on server and client. */
function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return TINTS[hash % TINTS.length];
}

export function Avatar({
  src,
  firstName,
  lastName,
  size = "md",
  className,
}: AvatarProps) {
  const fullName = `${firstName} ${lastName}`.trim();
  const base = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
    "ring-1 ring-inset ring-border",
    SIZES[size],
    className,
  );

  if (src) {
    return (
      // Avatar URLs are user-supplied and arbitrary, so next/image would need a
      // remotePattern per host. A plain <img> is the correct trade here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={fullName}
        className={cn(base, "bg-surface-sunken object-cover")}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={fullName}
      className={cn(base, "font-semibold", tintFor(fullName))}
    >
      {initials(firstName, lastName)}
    </span>
  );
}

export interface AvatarGroupProps {
  children: ReactNode;
  /** Avatars past this count collapse into a single +N chip. */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({
  children,
  max = 4,
  size = "sm",
  className,
}: AvatarGroupProps) {
  const items = Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((child, i) => (
        <div key={i} className="rounded-full ring-2 ring-surface-raised">
          {child}
        </div>
      ))}
      {overflow > 0 ? (
        <span
          aria-label={`${overflow} more`}
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "bg-surface-sunken font-semibold text-muted-strong",
            "ring-2 ring-surface-raised",
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
