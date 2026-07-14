import type { Metadata } from "next";
import { AlertTriangle, CircleCheckBig, Flame } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat";
import { StreakHeatmap, TaskCompletionChart } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { formatDate, isoDay, today } from "@/lib/dates";
import { scoreTone } from "@/lib/utils";
import {
  getTaskBoard,
  missedDays,
  taskBreakdown,
  taskHistory,
} from "@/server/core-tasks";

import { TodayTasks } from "../dashboard/today-tasks";
import { DateNav } from "./date-nav";

export const metadata: Metadata = { title: "Core Tasks" };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_DAYS = 60;
const CHART_DAYS = 30;
const MISSED_PREVIEW = 5;

export default async function CoreTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const todayIso = isoDay(today());

  // A board for tomorrow would be a board for a day nobody has lived yet.
  const requested = params.date;
  const selectedIso =
    requested && ISO_DAY.test(requested) && requested <= todayIso
      ? requested
      : todayIso;

  const selectedDate = new Date(`${selectedIso}T00:00:00.000Z`);
  const isToday = selectedIso === todayIso;

  const [board, history, breakdown, missed] = await Promise.all([
    getTaskBoard(user, user.id, selectedDate),
    taskHistory(user, user.id, HISTORY_DAYS),
    taskBreakdown(user, user.id, CHART_DAYS),
    missedDays(user, user.id, CHART_DAYS),
  ]);

  const recent = history.slice(-CHART_DAYS);
  const keptDays = recent.filter((day) => day.completed > 0).length;

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Core tasks</h1>
        <p className="mt-1.5 text-sm text-muted">
          The daily disciplines. Thirty percent of your overall score is simply
          showing up.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={isToday ? "Today" : "Selected day"}
          value={`${board.completedCount}/${board.total}`}
          icon={CircleCheckBig}
          tone={scoreTone(board.percent)}
        />
        <StatCard
          label="Days kept (30d)"
          value={`${keptDays}/${recent.length}`}
          icon={Flame}
        />
        <StatCard
          label="Days missed (30d)"
          value={missed.length}
          icon={AlertTriangle}
          tone={missed.length > 0 ? "critical" : undefined}
        />
      </section>

      {missed.length > 0 ? (
        <div className="flex flex-wrap items-start gap-3 rounded-card border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {missed.length} missed {missed.length === 1 ? "day" : "days"} in
              the last 30
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Nothing was ticked on{" "}
              {missed
                .slice(-MISSED_PREVIEW)
                .map((day) => formatDate(new Date(`${day}T00:00:00.000Z`)))
                .join(", ")}
              {missed.length > MISSED_PREVIEW ? " and others" : ""}. Pick a past
              date below to log what you actually did.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle as="h2">
              {isToday ? "Today's board" : formatDate(board.date)}
            </CardTitle>
            <CardDescription>
              {board.completedCount} of {board.total} done — {board.percent}%.
              {isToday ? "" : " Logging a past day is allowed."}
            </CardDescription>
          </div>
          <DateNav date={selectedIso} today={todayIso} />
        </CardHeader>

        <CardContent>
          {board.items.length ? (
            <>
              <ProgressBar
                value={board.percent}
                showValue={false}
                size="sm"
                className="mb-4"
              />
              <TodayTasks
                userId={user.id}
                date={selectedIso}
                showNotes
                items={board.items.map((item) => ({
                  taskId: item.taskId,
                  name: item.name,
                  icon: item.icon,
                  completed: item.completed,
                  notes: item.notes,
                }))}
              />
            </>
          ) : (
            <EmptyState
              icon={CircleCheckBig}
              title="No core tasks yet"
              description="Your organization hasn't set up the daily disciplines. Ask your coach."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Completion history</CardTitle>
            <CardDescription>
              The last 30 days, as a share of the day&apos;s tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaskCompletionChart data={recent} height={240} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Streak</CardTitle>
            <CardDescription>
              The last 60 days. A filled square is a day you showed up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StreakHeatmap
              data={history.map((day) => ({
                date: day.date,
                kept: day.completed > 0,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Per-task breakdown</CardTitle>
          <CardDescription>
            Which discipline is carrying you, and which one is slipping — last
            30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.length ? (
            <ul className="flex flex-col gap-5">
              {breakdown.map((task) => (
                <li key={task.key}>
                  <ProgressBar value={task.percent} label={task.name} />
                  <p className="mt-1.5 text-xs text-muted">
                    {task.completed} of {task.possible} days
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CircleCheckBig}
              title="Nothing to break down"
              description="Once your organization defines core tasks, this fills in."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
