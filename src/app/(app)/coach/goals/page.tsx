import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Target } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { listMenteeGoals } from "@/server/goals";
import { formatDate } from "@/lib/dates";
import { cn, formatScore } from "@/lib/utils";
import {
  Avatar,
  Badge,
  EmptyState,
  ProgressBar,
  StatusBadge,
} from "@/components/ui";

import { GOAL_CATEGORY_LABELS } from "../../goals/categories";
import { GoalScoreBadge } from "../../goals/goal-score-badge";

export const metadata: Metadata = { title: "Goals" };

/**
 * Every mentee's goals on one page, grouped by mentee. Read-only: rows link out
 * to the existing goal and profile pages. Scope lives in the URL, and each
 * mentee is a native <details> block, so the page ships no client JavaScript.
 */

type SearchParams = Promise<{ scope?: string }>;

const asScope = (value: string | undefined): "councils" | "all" =>
  value === "all" ? "all" : "councils";

export default async function CoachGoalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireCoach();
  const { scope: scopeParam } = await searchParams;
  const scope = asScope(scopeParam);

  const groups = await listMenteeGoals(user, { scope });

  const scopes = [
    { key: "councils" as const, label: "My councils", href: "/coach/goals" },
    {
      key: "all" as const,
      label: "All mentees",
      href: "/coach/goals?scope=all",
    },
  ];

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Goals
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every mentee&rsquo;s goals on one page. Open a goal or a profile to
            make changes.
          </p>
        </div>

        <div
          className="inline-flex w-fit rounded-lg border border-border bg-surface-sunken p-1 text-sm"
          role="tablist"
          aria-label="Which mentees to show"
        >
          {scopes.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              role="tab"
              aria-selected={scope === s.key}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                scope === s.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          icon={Target}
          title={
            scope === "councils"
              ? "No mentees in your councils yet"
              : "No mentees to show"
          }
          description={
            scope === "councils"
              ? "Once mentees are placed in a council you lead, their goals gather here."
              : "No mentee in the organization is visible to you yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <details
              key={group.mentee.id}
              open
              className="overflow-hidden rounded-card border border-border bg-surface"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                <Avatar
                  src={group.mentee.avatarUrl}
                  firstName={group.mentee.firstName}
                  lastName={group.mentee.lastName}
                  size="sm"
                />
                <Link
                  href={`/coach/mentees/${group.mentee.id}`}
                  className="font-semibold text-foreground hover:text-primary"
                >
                  {group.mentee.firstName} {group.mentee.lastName}
                </Link>

                {group.missingCategories.map((key) => (
                  <Badge key={key} variant="danger" size="sm">
                    <AlertTriangle aria-hidden="true" />
                    No {GOAL_CATEGORY_LABELS[key]} goal
                  </Badge>
                ))}

                <span className="ml-auto text-sm text-muted">
                  Goal Score{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatScore(group.goalTotalScore)}
                  </span>
                </span>
              </summary>

              <div className="border-t border-border">
                {group.goals.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">
                    No goals set yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {group.goals.map((goal) => (
                      <li key={goal.id}>
                        <Link
                          href={`/goals/${goal.id}`}
                          className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-4"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <StatusBadge status={goal.status} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {goal.title}
                              </span>
                              <span className="text-xs text-muted">
                                {goal.category.name}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 sm:w-72 sm:shrink-0">
                            <div className="flex-1">
                              <ProgressBar
                                value={goal.progress}
                                showValue={false}
                              />
                            </div>
                            <GoalScoreBadge score={goal.score} />
                          </div>

                          <span
                            className={cn(
                              "text-xs sm:w-28 sm:shrink-0 sm:text-right",
                              goal.isOverdue
                                ? "font-medium text-rose-500 dark:text-rose-400"
                                : "text-muted",
                            )}
                          >
                            {goal.isOverdue ? "Overdue · " : "Due "}
                            {formatDate(goal.targetDate)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
