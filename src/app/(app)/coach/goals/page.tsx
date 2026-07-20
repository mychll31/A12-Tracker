import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Search, Target } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { listMenteeGoals, type MenteeGoalsFilter } from "@/server/goals";
import { listCoachNavGroups } from "@/server/mentees";
import { GOAL_CATEGORY_KEYS, type GoalCategoryKey } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { cn, formatScore } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  ProgressBar,
  Select,
  StatusBadge,
} from "@/components/ui";

import { GOAL_CATEGORY_LABELS } from "../../goals/categories";
import { GoalScoreBadge } from "../../goals/goal-score-badge";

export const metadata: Metadata = { title: "Goals" };

/**
 * Every mentee's goals on one page, grouped by mentee. Read-only: rows link out
 * to the existing goal and profile pages (carrying a `from` so those pages can
 * offer a "Back to Goals" link). Filters live entirely in the URL — a GET form,
 * server-rendered, no client JavaScript.
 */

type SearchParams = Promise<{
  council?: string;
  search?: string;
  category?: string;
  op?: string;
  score?: string;
}>;

const SCORE_OPS = ["gte", "gt", "eq", "lt"] as const;

export default async function CoachGoalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireCoach();
  const sp = await searchParams;

  // Normalise the raw query into a typed filter.
  const council = sp.council ?? "";
  const search = sp.search?.trim() || undefined;
  const category = (GOAL_CATEGORY_KEYS as readonly string[]).includes(
    sp.category ?? "",
  )
    ? (sp.category as GoalCategoryKey)
    : undefined;
  const scoreOp = (SCORE_OPS as readonly string[]).includes(sp.op ?? "")
    ? (sp.op as (typeof SCORE_OPS)[number])
    : undefined;
  const parsedScore =
    sp.score !== undefined && sp.score !== "" ? Number(sp.score) : NaN;
  const scoreValue = scoreOp && Number.isFinite(parsedScore) ? parsedScore : undefined;

  const filter: MenteeGoalsFilter = {
    council,
    search,
    category,
    scoreOp,
    scoreValue,
  };

  const [groups, councils] = await Promise.all([
    listMenteeGoals(user, filter),
    listCoachNavGroups(user),
  ]);

  // Rebuild the canonical board URL so every drill-in link can return here with
  // the same filters. Only well-formed params are echoed back.
  const qs = new URLSearchParams();
  if (council) qs.set("council", council);
  if (search) qs.set("search", search);
  if (category) qs.set("category", category);
  if (scoreOp) qs.set("op", scoreOp);
  if (scoreValue !== undefined) qs.set("score", String(scoreValue));
  const boardUrl = qs.toString() ? `/coach/goals?${qs.toString()}` : "/coach/goals";
  const fromQuery = `from=${encodeURIComponent(boardUrl)}`;

  const filtersActive = Boolean(council || search || category || scoreOp);

  const councilOptions = [
    { value: "", label: "All my councils" },
    ...councils.map((c) => ({ value: c.id, label: c.name })),
    { value: "all", label: "All mentees" },
  ];
  const categoryOptions = [
    { value: "", label: "All categories" },
    ...GOAL_CATEGORY_KEYS.map((k) => ({
      value: k,
      label: GOAL_CATEGORY_LABELS[k],
    })),
  ];
  const opOptions = [
    { value: "", label: "Any score" },
    { value: "gte", label: "≥" },
    { value: "gt", label: ">" },
    { value: "eq", label: "=" },
    { value: "lt", label: "<" },
  ];

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Goals
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every mentee&rsquo;s goals on one page. Open a goal or a profile to
            make changes.
          </p>
        </div>

        {/* Filters live in the URL, so a filtered board is a link you can share
            or bookmark. */}
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-end [&>*]:min-w-0"
          role="search"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="f-council"
              className="text-sm font-medium text-muted-strong"
            >
              Council
            </label>
            <Select
              id="f-council"
              name="council"
              options={councilOptions}
              defaultValue={council}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="f-search"
              className="text-sm font-medium text-muted-strong"
            >
              Mentee
            </label>
            <Input
              id="f-search"
              name="search"
              type="search"
              defaultValue={search ?? ""}
              placeholder="Name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="f-category"
              className="text-sm font-medium text-muted-strong"
            >
              Category
            </label>
            <Select
              id="f-category"
              name="category"
              options={categoryOptions}
              defaultValue={category ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="f-op"
              className="text-sm font-medium text-muted-strong"
            >
              Goal score
            </label>
            <div className="flex gap-2">
              <Select
                id="f-op"
                name="op"
                aria-label="Score operator"
                options={opOptions}
                defaultValue={scoreOp ?? ""}
                className="w-24 shrink-0"
              />
              <Input
                name="score"
                type="number"
                min={0}
                max={100}
                aria-label="Score percentage"
                defaultValue={scoreValue !== undefined ? String(scoreValue) : ""}
                placeholder="%"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <Button type="submit" icon={<Search />}>
              Apply filters
            </Button>
            {filtersActive ? (
              <Link
                href="/coach/goals"
                className="text-sm font-medium text-primary hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          icon={Target}
          title={
            filtersActive
              ? "Nothing matches these filters"
              : council === "all"
                ? "No mentees to show"
                : "No mentees in your councils yet"
          }
          description={
            filtersActive
              ? "No mentee or goal matches the current filters. Try widening them."
              : council === "all"
                ? "No mentee in the organization is visible to you yet."
                : "Once mentees are placed in a council you lead, their goals gather here."
          }
          action={
            filtersActive ? (
              <Link
                href="/coach/goals"
                className="text-sm font-medium text-primary hover:underline"
              >
                Clear filters
              </Link>
            ) : undefined
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
                  href={`/coach/mentees/${group.mentee.id}?${fromQuery}`}
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
                          href={`/goals/${goal.id}?${fromQuery}`}
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
