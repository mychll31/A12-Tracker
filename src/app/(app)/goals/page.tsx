import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Flag, Target } from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar, ScoreRing } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import {
  GOAL_CATEGORY_KEYS,
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  type GoalCategoryKey,
  type GoalStatus,
} from "@/lib/domain";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";
import { goalSummaryFor, listGoals } from "@/server/goals";

import { GOAL_CATEGORY_LABELS } from "./categories";
import { GoalScoreBadge } from "./goal-score-badge";
import { GoalRankMedal } from "./goal-rank-medal";
import { NewGoalDialog } from "./new-goal-dialog";

export const metadata: Metadata = { title: "My Goals" };

type Search = { category?: string; status?: string };

function asCategory(value?: string): GoalCategoryKey | undefined {
  return GOAL_CATEGORY_KEYS.find((key) => key === value);
}

function asStatus(value?: string): GoalStatus | undefined {
  return GOAL_STATUSES.find((key) => key === value);
}

function chipHref(next: Search): string {
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.status) params.set("status", next.status);
  const query = params.toString();
  return query ? `/goals?${query}` : "/goals";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-medium",
        "ring-1 ring-inset transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "bg-primary-soft text-primary ring-primary/20"
          : "bg-surface-raised text-muted ring-border hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const category = asCategory(params.category);
  const status = asStatus(params.status);

  const [goals, stats] = await Promise.all([
    listGoals(user, user.id, { categoryKey: category, status }),
    goalSummaryFor(user.id),
  ]);

  const missing = stats.missingCategories;

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My goals</h1>
          <p className="mt-1.5 text-sm text-muted">
            Personal, professional and contribution — combined into your Goal
            Total Score.
          </p>
        </div>
        <NewGoalDialog />
      </header>

      {missing.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-card border border-rose-500/20 bg-rose-500/5 p-4 sm:flex-row sm:items-center">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-rose-500"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
              {missing.map((key) => GOAL_CATEGORY_LABELS[key]).join(" and ")}{" "}
              {missing.length === 1 ? "has" : "have"} no goal yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              All three categories are required. An empty category scores 0, and
              that zero is averaged straight into your Goal Total Score.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {missing.map((key) => (
              <NewGoalDialog
                key={key}
                defaultCategory={key}
                triggerLabel={`Set your ${GOAL_CATEGORY_LABELS[key]} goal`}
                triggerVariant="outline"
                triggerSize="sm"
              />
            ))}
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 p-6 text-center lg:w-72">
          <ScoreRing
            score={stats.goalTotalScore}
            size={144}
            strokeWidth={12}
            label="Goal Total Score"
            sublabel="of 100"
          />
          <p className="text-sm font-semibold tracking-tight">
            Goal Total Score
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Your Personal, Professional and Contribution scores, combined into
            one out of 100.
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Total goals" value={stats.total} icon={Target} />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={Flag}
            tone="excellent"
          />
          <StatCard
            label="In progress"
            value={stats.inProgress}
            icon={CalendarClock}
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon={AlertTriangle}
            tone={stats.overdue > 0 ? "critical" : undefined}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            The three categories
          </h2>
          <p className="text-xs text-muted">Each pulls equal weight.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {GOAL_CATEGORY_KEYS.map((key) => {
            const row = stats.byCategory[key];
            const empty = row.total === 0;

            return (
              <Card key={key} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {GOAL_CATEGORY_LABELS[key]}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.total} {row.total === 1 ? "goal" : "goals"} ·{" "}
                      {row.completed} completed
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-2xl font-semibold tabular-nums leading-none",
                      TONE_TEXT[scoreTone(row.score)],
                    )}
                  >
                    {formatScore(row.score)}
                  </span>
                </div>

                <ProgressBar
                  value={row.score}
                  label="Category score"
                  showValue={false}
                />

                {empty ? (
                  <div className="mt-auto flex flex-col gap-2">
                    <p className="text-xs font-medium text-rose-500 dark:text-rose-400">
                      No goal set — scoring 0
                    </p>
                    <NewGoalDialog
                      defaultCategory={key}
                      triggerLabel={`Set your ${GOAL_CATEGORY_LABELS[key]} goal`}
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div
          className="scroll-thin flex items-center gap-2 overflow-x-auto pb-1"
          aria-label="Filter by category"
        >
          <Chip href={chipHref({ status: params.status })} active={!category}>
            All
          </Chip>
          {GOAL_CATEGORY_KEYS.map((key) => (
            <Chip
              key={key}
              href={chipHref({ category: key, status: params.status })}
              active={category === key}
            >
              {GOAL_CATEGORY_LABELS[key]}
              <span className="ml-1.5 text-muted">
                {stats.byCategory[key].total}
              </span>
            </Chip>
          ))}
        </div>

        <div
          className="scroll-thin flex items-center gap-2 overflow-x-auto pb-1"
          aria-label="Filter by status"
        >
          <Chip href={chipHref({ category: params.category })} active={!status}>
            Any status
          </Chip>
          {GOAL_STATUSES.map((key) => (
            <Chip
              key={key}
              href={chipHref({ category: params.category, status: key })}
              active={status === key}
            >
              {GOAL_STATUS_LABELS[key]}
            </Chip>
          ))}
        </div>
      </section>

      {goals.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Link
                href={`/goals/${goal.id}`}
                className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card className="flex h-full flex-col gap-4 p-5 transition-colors hover:border-border-strong">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm" variant="primary">
                      {GOAL_CATEGORY_LABELS[goal.category.key]}
                    </Badge>
                    <StatusBadge size="sm" status={goal.status} />
                    <GoalScoreBadge score={goal.score} className="ml-auto" />
                    <GoalRankMedal score={goal.score} size="sm" />
                  </div>

                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {goal.title}
                  </h2>

                  {goal.score === null ? (
                    <p className="mt-auto text-xs text-muted">
                      Withdrawn from scoring — an abandoned goal is left out of
                      your averages rather than counted as a zero.
                    </p>
                  ) : (
                    <ProgressBar value={goal.progress} className="mt-auto" />
                  )}

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        goal.isOverdue
                          ? "font-medium text-rose-500 dark:text-rose-400"
                          : "text-muted",
                      )}
                    >
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      {formatDate(goal.targetDate)}
                      <span aria-hidden="true">·</span>
                      {goal.isOverdue
                        ? `${Math.abs(goal.daysUntilDue)}d overdue`
                        : goal.daysUntilDue === 0
                          ? "due today"
                          : `${goal.daysUntilDue}d left`}
                    </span>

                    <span className="shrink-0 text-muted">
                      {goal.completedTasks}/{goal.taskCount} tasks
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Target}
          title={
            category
              ? `No ${GOAL_CATEGORY_LABELS[category].toLowerCase()} goal yet`
              : "No goals match that filter"
          }
          description={
            category
              ? "All three categories are required — an empty one scores 0. Set a goal here to lift your Goal Total Score."
              : "Try a different status, or clear the filters."
          }
          action={
            category ? (
              <NewGoalDialog
                defaultCategory={category}
                triggerLabel={`Set your ${GOAL_CATEGORY_LABELS[category]} goal`}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
