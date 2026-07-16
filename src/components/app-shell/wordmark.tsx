import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Abundance 12 mark: the glowing orb and the lockup, straight off the landing
 * page. It lives here as one component because it appears in the sidebar, the
 * mobile header and the mobile drawer — three copies of the same inline markup is
 * exactly how a logo quietly drifts out of sync with itself.
 */
export function Wordmark({
  href = "/dashboard",
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const orb = size === "sm" ? "size-7" : "size-9";

  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", orb)}
        style={{
          border: "2.5px solid #58c8ff",
          background:
            "radial-gradient(circle at 50% 45%, #7fe0ff 0%, #2a6fbf 55%, #0b1a33 100%)",
          boxShadow: "0 0 18px rgba(88,200,255,.45)",
        }}
      />
      <span className="leading-none">
        <span className="block font-display text-[0.9375rem] font-bold tracking-[0.05em]">
          ABUNDANCE 12
        </span>
        <span
          className="mt-1 block text-[0.5625rem] tracking-[0.28em]"
          style={{ color: "var(--score-warning)" }}
        >
          THE GAME OF MY LIFE
        </span>
      </span>
    </Link>
  );
}
