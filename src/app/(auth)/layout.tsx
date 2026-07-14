import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* The pitch. Hidden below lg, where the form deserves the whole screen. */}
      <aside className="relative hidden overflow-hidden bg-surface-sunken lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-16 size-[24rem] rounded-full bg-amber-500/10 blur-3xl"
        />

        <Link
          href="/"
          className="relative flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          Abundance Hub
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">
            Growth you can actually measure.
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Goals across your personal, professional and contribution life. Four
            daily disciplines. A coach who sees your progress — and a score that
            tells the truth about whether you showed up.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6">
            {[
              ["3", "Goal categories"],
              ["4", "Daily core tasks"],
              ["6", "Leaderboards"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold tabular-nums">{value}</dt>
                <dd className="mt-1 text-xs text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-muted">
          Coaching, accountability and personal growth.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-slide-up">{children}</div>
      </main>
    </div>
  );
}
