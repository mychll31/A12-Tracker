import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarCheck, CircleCheckBig, Flame } from "lucide-react";

import {
  CategoryRadarChart,
  MoodChart,
  ScoreTrendChart,
  StreakHeatmap,
  TaskCompletionChart,
} from "@/components/charts";
import {
  Card,
  EmptyState,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { computeUserScore } from "@/lib/scoring";
import { cn, formatScore, scoreTone } from "@/lib/utils";
import {
  categoryBreakdown,
  moodTrend,
  userScoreTrend,
  userStreakHistory,
  userTaskTrend,
  weeklyRollup,
} from "@/server/analytics";

import { AccessNotice, guard } from "../_components/guard";

export const metadata: Metadata = { title: "My Analytics" };

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/** The heatmap is always 60 days: a streak needs a runway longer than the range. */
const HEATMAP_DAYS = 60;

function asRange(value: string | undefined): Range {
  const parsed = Number(value);
  return (RANGES as readonly number[]).includes(parsed) ? (parsed as Range) : 30;
}

const mean = (values: number[]): number =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My Analytics</h1>
      <p className="mt-1 text-sm text-muted">
        The shape of your effort — scores, disciplines, streaks and mood over
        time.
      </p>
    </div>
  );
}

function ChartCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <Card className={cn("p-5", className)}>{children}</Card>;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range: rangeParam } = await searchParams;
  const days = asRange(rangeParam);

  // These are a *mentee's* numbers — goals, core tasks, check-ins. An account
  // that only coaches has none of them, so there is nothing here to draw.
  if (!user.isMentee) {
    return (
      <div className="animate-slide-up">
        <Header />
        <div className="mt-8">
          <EmptyState
            icon={BarChart3}
            title="Personal analytics are for mentees"
            description="Your account coaches rather than tracks. Organization-wide trends live on the Organization page."
            // A link, not a Button: Button renders a <button>, and interactive
            // content may not be nested inside an anchor.
            action={
              <Link
                href="/organization"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-sunken px-4 text-sm font-medium text-foreground transition-colors hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Open organization analytics
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const loaded = await guard(async () => {
    const [score, scoreTrend, taskTrend, categories, streak, mood, rollup] =
      await Promise.all([
        computeUserScore(user.id),
        userScoreTrend(user, user.id, days),
        userTaskTrend(user, user.id, days),
        categoryBreakdown(user, user.id),
        userStreakHistory(user, user.id, HEATMAP_DAYS),
        moodTrend(user, user.id, days),
        // The rollup is measured in weeks, not days — never fewer than four, or
        // the 7-day range would render a single-row table.
        weeklyRollup(user, user.id, Math.max(4, Math.ceil(days / 7))),
      ]);

    return { score, scoreTrend, taskTrend, categories, streak, mood, rollup };
  });

  if (!loaded.ok) {
    return (
      <div className="animate-slide-up">
        <Header />
        <div className="mt-8">
          <AccessNotice message={loaded.message} />
        </div>
      </div>
    );
  }

  const { score, scoreTrend, taskTrend, categories, streak, mood, rollup } =
    loaded.data;

  const averageScore = mean(scoreTrend.map((p) => p.overall));
  const tasksCompleted = taskTrend.reduce((sum, d) => sum + d.completed, 0);

  return (
    <div className="animate-slide-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Header />

        <nav
          aria-label="Date range"
          className="flex items-center gap-1 rounded-xl border border-border bg-surface-sunken p-1"
        >
          {RANGES.map((option) => {
            const selected = option === days;
            return (
              <Link
                key={option}
                href={`/analytics?range=${option}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected
                    ? "card-shadow bg-surface-raised text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {option} days
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Best streak"
          value={`${score.longestStreak} days`}
          icon={Flame}
        />
        <StatCard
          label="Average score"
          value={formatScore(averageScore)}
          icon={BarChart3}
          tone={scoreTone(averageScore)}
        />
        <StatCard
          label="Tasks completed"
          value={tasksCompleted}
          icon={CircleCheckBig}
        />
        <StatCard
          label="Check-in rate"
          value={`${formatScore(score.checkInRate)}%`}
          icon={CalendarCheck}
          tone={scoreTone(score.checkInRate)}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard className="lg:col-span-2">
          <ScoreTrendChart
            data={scoreTrend}
            title="Score history"
            description={`Your Goal Total Score, core tasks and consistency, over ${days} days.`}
          />
        </ChartCard>

        <ChartCard>
          <TaskCompletionChart
            data={taskTrend}
            title="Core task completion"
            description="How much of each day's discipline you finished."
          />
        </ChartCard>

        <ChartCard>
          <CategoryRadarChart
            data={categories}
            title="Goal categories"
            description="Personal, professional and contribution — side by side."
          />
        </ChartCard>

        <ChartCard>
          <StreakHeatmap
            data={streak}
            title="Streak history"
            description={`The last ${HEATMAP_DAYS} days. A day counts when you completed a core task or filed a check-in.`}
          />
        </ChartCard>

        <ChartCard>
          <MoodChart
            data={mood}
            title="Mood"
            description="From your daily check-ins. Days you didn't check in are left blank."
          />
        </ChartCard>
      </div>

      <Card className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Weekly rollup</h3>
        <p className="mt-0.5 text-xs text-muted">
          Each week, labelled by the Monday it started on.
        </p>

        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Week</TH>
              <TH className="text-right">Avg score</TH>
              <TH className="text-right">Tasks completed</TH>
              <TH className="text-right">Check-ins</TH>
            </TR>
          </THead>
          <TBody>
            {rollup.map((week) => (
              <TR key={week.week}>
                <TD className="font-medium">
                  {formatDate(new Date(week.week))}
                </TD>
                <TD className="text-right tabular-nums">
                  {formatScore(week.avgScore)}
                </TD>
                <TD className="text-right tabular-nums">
                  {week.tasksCompleted}
                </TD>
                <TD className="text-right tabular-nums">{week.checkIns}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
