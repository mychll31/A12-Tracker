import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  CircleCheckBig,
  Flame,
  MessageSquareQuote,
  NotebookPen,
  Target,
  Trophy,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar, ScoreRing } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat";
import { ScoreTrendChart } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { formatDate, formatRelative, isoDay, today } from "@/lib/dates";
import { GOAL_CATEGORY_KEYS } from "@/lib/domain";
import { cn, formatScore, ordinal, scoreTone, TONE_TEXT } from "@/lib/utils";
import { getMenteeDashboard } from "@/server/dashboard";
import { goalSummaryFor } from "@/server/goals";

import { GOAL_CATEGORY_LABELS } from "../goals/categories";
import { TaskIcon } from "./lucide-icon";
import { TodayTasks } from "./today-tasks";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  // A coach-only account has no mentee dashboard to render.
  if (!user.isMentee && (user.isCoach || user.isAdmin)) redirect("/coach");

  // The dashboard payload's byCategory carries only counts and avgProgress — the
  // Goal Total Score, the per-category scores and the required-category gaps come
  // from goalSummaryFor, the same source the goals page reads.
  const [dash, goalStats] = await Promise.all([
    getMenteeDashboard(user),
    goalSummaryFor(user.id),
  ]);
  const { score, todayTasks, goals } = dash;
  const day = isoDay(today());

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.firstName}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Your goals, your daily disciplines, and the score that proves you
          showed up.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[auto_1fr] [&>*]:min-w-0">
        <Card className="flex flex-col items-center justify-center gap-3 p-6 lg:w-64">
          <ScoreRing
            score={score.overallScore}
            size={144}
            strokeWidth={12}
            label="Overall score"
            sublabel="Overall"
          />
          <p className="text-center text-xs leading-relaxed text-muted">
            Goals {formatScore(score.goalScore)} · Core tasks{" "}
            {formatScore(score.coreTaskScore)} · Consistency{" "}
            {formatScore(score.consistencyScore)}
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Current streak"
            icon={Flame}
            href="/core-tasks"
            value={
              <>
                {score.currentStreak}
                <span className="ml-1 text-base font-medium text-muted">
                  {score.currentStreak === 1 ? "day" : "days"}
                </span>
              </>
            }
          />
          <StatCard
            label="Council rank"
            icon={Trophy}
            href="/leaderboards"
            value={
              dash.groupRank ? (
                <>
                  {ordinal(dash.groupRank.rank)}
                  <span className="ml-1 text-base font-medium text-muted">
                    of {dash.groupRank.total}
                  </span>
                </>
              ) : (
                "—"
              )
            }
          />
          <StatCard
            label="Goals completed"
            icon={Target}
            href="/goals"
            value={
              <>
                {goals.completed}
                <span className="ml-1 text-base font-medium text-muted">
                  of {goals.total}
                </span>
              </>
            }
          />
          <StatCard
            label="Core task completion"
            icon={CircleCheckBig}
            href="/core-tasks"
            tone={scoreTone(score.taskCompletionRate)}
            value={`${formatScore(score.taskCompletionRate)}%`}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2">Today&apos;s core tasks</CardTitle>
            <CardDescription>
              {todayTasks.completed} of {todayTasks.total} done —{" "}
              {todayTasks.percent}% of today&apos;s discipline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todayTasks.items.length ? (
              <>
                <ProgressBar
                  value={todayTasks.percent}
                  showValue={false}
                  size="sm"
                  className="mb-4"
                />
                <TodayTasks
                  userId={user.id}
                  date={day}
                  items={todayTasks.items.map((item) => ({
                    taskId: item.id,
                    name: item.name,
                    icon: item.icon,
                    completed: item.completed,
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

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle as="h2">Daily check-in</CardTitle>
            <CardDescription>
              {formatDate(today())} — wins, challenges, gratitude.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            {dash.hasCheckedInToday ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-emerald-500/10">
                  <CheckCircle2
                    className="size-6 text-emerald-500"
                    aria-hidden="true"
                  />
                </span>
                <p className="text-sm font-medium">Checked in for today</p>
                <p className="text-xs text-muted">
                  Something to add? The form saves over today&apos;s entry.
                </p>
                <Link href="/check-in" className="inline-flex">
                  <Button variant="secondary" size="sm" tabIndex={-1}>
                    View or edit
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-primary-soft">
                  <NotebookPen
                    className="size-6 text-primary"
                    aria-hidden="true"
                  />
                </span>
                <p className="text-sm font-medium">
                  You haven&apos;t checked in today
                </p>
                <p className="text-xs text-muted">
                  Two minutes. It feeds your consistency score.
                </p>
                <Link href="/check-in" className="inline-flex">
                  <Button icon={<ArrowRight />} tabIndex={-1}>
                    Start today&apos;s check-in
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Goal Total Score
          </h2>
          <Link
            href="/goals"
            className="text-sm font-medium text-primary hover:underline"
          >
            All goals
          </Link>
        </div>

        {goalStats.missingCategories.length > 0 ? (
          <Link
            href="/goals"
            className="flex items-start gap-2.5 rounded-card border border-rose-500/20 bg-rose-500/5 px-4 py-3 transition-colors hover:border-rose-500/40"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-rose-500"
              aria-hidden="true"
            />
            <span className="text-xs leading-relaxed">
              <span className="font-medium text-rose-600 dark:text-rose-400">
                No{" "}
                {goalStats.missingCategories
                  .map((key) => GOAL_CATEGORY_LABELS[key].toLowerCase())
                  .join(" or ")}{" "}
                goal yet.
              </span>{" "}
              <span className="text-muted">
                All three categories are required — an empty one scores 0 and is
                averaged straight into your Goal Total Score. Set it now.
              </span>
            </span>
          </Link>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Card className="flex flex-col items-center justify-center gap-3 p-5 text-center">
            <ScoreRing
              score={goalStats.goalTotalScore}
              size={120}
              label="Goal Total Score"
              sublabel="of 100"
            />
            <p className="text-xs leading-relaxed text-muted">
              The three categories combined — half of your Overall Score.
            </p>
          </Card>

          {GOAL_CATEGORY_KEYS.map((key) => {
            const row = goalStats.byCategory[key];
            const empty = row.total === 0;

            return (
              <Card key={key} className="flex flex-col p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {GOAL_CATEGORY_LABELS[key]}
                  </p>
                  <Badge size="sm" variant={empty ? "danger" : "neutral"}>
                    {empty
                      ? "None set"
                      : `${row.total} goal${row.total === 1 ? "" : "s"}`}
                  </Badge>
                </div>

                <p
                  className={cn(
                    "mt-3 text-2xl font-semibold leading-none tabular-nums",
                    TONE_TEXT[scoreTone(row.score)],
                  )}
                >
                  {formatScore(row.score)}
                </p>

                <ProgressBar
                  value={row.score}
                  className="mt-3"
                  label="Category score"
                  showValue={false}
                />

                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {empty ? (
                    <span className="font-medium text-rose-500 dark:text-rose-400">
                      No goal set — scoring 0
                    </span>
                  ) : (
                    `${row.completed} of ${row.total} completed`
                  )}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Upcoming deadlines</CardTitle>
            <CardDescription>
              {goals.overdue > 0
                ? `${goals.overdue} goal${goals.overdue === 1 ? " is" : "s are"} already overdue.`
                : "Goals with a target date ahead of you."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dash.upcomingDeadlines.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {dash.upcomingDeadlines.map((goal) => {
                  const late = goal.daysUntil <= 0;
                  return (
                    <li key={goal.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/goals/${goal.id}`}
                        className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <CalendarClock
                          className={cn(
                            "size-4 shrink-0",
                            late ? "text-rose-500" : "text-muted",
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {goal.title}
                          </span>
                          <span className="block text-xs text-muted">
                            {
                              GOAL_CATEGORY_LABELS[
                                goal.categoryKey as keyof typeof GOAL_CATEGORY_LABELS
                              ]
                            }{" "}
                            · {formatDate(goal.targetDate)}
                          </span>
                        </span>
                        <Badge size="sm" variant={late ? "danger" : "neutral"}>
                          {goal.daysUntil === 0
                            ? "Due today"
                            : `${goal.daysUntil}d left`}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Nothing due"
                description="No open goal has a target date coming up."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Coach feedback</CardTitle>
            <CardDescription>
              The latest notes on your goals and check-ins.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {dash.coach ? (
              <div className="flex items-center gap-3 rounded-xl bg-surface-sunken p-3">
                <Avatar
                  src={dash.coach.avatarUrl}
                  firstName={dash.coach.firstName}
                  lastName={dash.coach.lastName}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {dash.coach.firstName} {dash.coach.lastName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {dash.coach.headline ?? "Your coach"}
                  </p>
                </div>
              </div>
            ) : null}

            {dash.recentFeedback.length ? (
              <ul className="flex flex-col gap-4">
                {dash.recentFeedback.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <Avatar
                      size="sm"
                      src={item.author.avatarUrl}
                      firstName={item.author.firstName}
                      lastName={item.author.lastName}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                        <span className="font-medium text-foreground">
                          {item.author.firstName} {item.author.lastName}
                        </span>
                        <span>{formatRelative(item.createdAt)}</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        {item.body}
                      </p>
                      {item.goalTitle ? (
                        <p className="mt-1 truncate text-xs text-muted">
                          on “{item.goalTitle}”
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={MessageSquareQuote}
                title="No feedback yet"
                description="Your coach's comments on goals and check-ins will land here."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Personal analytics</CardTitle>
          <CardDescription>
            Your overall score and its three parts, over the last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dash.trend.length ? (
            <ScoreTrendChart data={dash.trend} height={280} />
          ) : (
            <EmptyState
              icon={Target}
              title="No history yet"
              description="Scores are snapshotted daily. Come back tomorrow to see the line."
            />
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Achievements</h2>

        {dash.achievements.length ? (
          <ul className="scroll-thin flex gap-3 overflow-x-auto pb-1">
            {dash.achievements.map((achievement) => (
              <li key={achievement.key}>
                <Card className="flex w-40 shrink-0 flex-col items-center gap-2 p-4 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-primary-soft">
                    <TaskIcon
                      name={achievement.icon}
                      className="size-5 text-primary"
                    />
                  </span>
                  <p className="text-sm font-semibold leading-tight">
                    {achievement.name}
                  </p>
                  <Badge size="sm" variant="primary">
                    {achievement.tier}
                  </Badge>
                  <p className="text-[0.6875rem] text-muted">
                    {formatRelative(achievement.unlockedAt)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Award}
            title="No achievements yet"
            description="Keep a streak, finish a goal, file your check-ins — they unlock as you go."
          />
        )}
      </section>
    </div>
  );
}
