import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Eye,
  Flame,
  Lock,
  NotebookPen,
  ShieldAlert,
  Target,
} from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { getMenteeProfile } from "@/server/mentees";
import {
  categoryBreakdown,
  moodTrend,
  userScoreTrend,
  userStreakHistory,
} from "@/server/analytics";
import { goalSummaryFor, listGoals } from "@/server/goals";
import { taskBreakdown, taskHistory } from "@/server/core-tasks";
import { listCheckIns } from "@/server/check-ins";
import { listNotesForMentee } from "@/server/notes";
import { GOAL_CATEGORY_KEYS, MOOD_LABELS } from "@/lib/domain";
import { formatDate, formatDateTime, formatRelative } from "@/lib/dates";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ProgressBar,
  ScoreRing,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import {
  CategoryRadarChart,
  MoodChart,
  ScoreTrendChart,
  StreakHeatmap,
  TaskCompletionChart,
} from "@/components/charts";

import { GOAL_CATEGORY_LABELS } from "../../../goals/categories";
import { GoalScoreBadge } from "../../../goals/goal-score-badge";
import { NewNoteButton, ReviewBox } from "./mentee-actions";

export const metadata: Metadata = { title: "Mentee" };

const TREND_DAYS = 30;
const HEATMAP_DAYS = 60;
const CHECK_IN_LIMIT = 20;

export default async function MenteeDrilldownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCoach();
  const { id } = await params;

  let profile;
  try {
    profile = await getMenteeProfile(user, id);
  } catch (error) {
    // The RBAC layer already decided; the page only has to say so kindly.
    if (error instanceof ForbiddenError) {
      return (
        <EmptyState
          icon={ShieldAlert}
          title="You cannot open this member"
          description={error.message}
          action={
            <Link
              href="/coach/mentees"
              className="text-sm font-medium text-primary hover:underline"
            >
              Back to mentees
            </Link>
          }
        />
      );
    }
    throw error;
  }

  const { score, group, canEdit } = profile;
  const mentee = profile.user;

  const [
    trend,
    categories,
    goals,
    goalStats,
    tasks,
    breakdown,
    streak,
    checkIns,
    moods,
    notes,
  ] = await Promise.all([
    userScoreTrend(user, id, TREND_DAYS),
    categoryBreakdown(user, id),
    listGoals(user, id),
    // getMenteeProfile above already asserted view access for this mentee.
    goalSummaryFor(id),
    taskHistory(user, id, TREND_DAYS),
    taskBreakdown(user, id, TREND_DAYS),
    userStreakHistory(user, id, HEATMAP_DAYS),
    listCheckIns(user, id, CHECK_IN_LIMIT),
    moodTrend(user, id, TREND_DAYS),
    listNotesForMentee(user, id),
  ]);

  const coachName = group
    ? `${group.coach.firstName} ${group.coach.lastName}`
    : null;

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <Link
          href="/coach/mentees"
          className="w-fit text-xs text-muted hover:text-foreground"
        >
          ← All mentees
        </Link>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar
            src={mentee.avatarUrl}
            firstName={mentee.firstName}
            lastName={mentee.lastName}
            size="lg"
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {mentee.firstName} {mentee.lastName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mentee.headline ?? "No headline yet."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              {group ? (
                <Link href={`/coach/groups/${group.id}`}>
                  <Badge variant="neutral">{group.name}</Badge>
                </Link>
              ) : (
                <Badge variant="neutral">No group</Badge>
              )}
              {coachName ? <span>Coached by {coachName}</span> : null}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Joined {formatDate(profile.joinedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame
                  className={cn(
                    "size-3.5",
                    score.currentStreak > 0 ? "text-amber-500" : "text-muted/40",
                  )}
                  aria-hidden="true"
                />
                {score.currentStreak}-day streak
              </span>
              <span>
                {mentee.lastActiveAt
                  ? `Active ${formatRelative(mentee.lastActiveAt)}`
                  : "Never active"}
              </span>
            </div>
          </div>

          <ScoreRing
            score={score.overallScore}
            size={104}
            sublabel="Overall"
            className="shrink-0"
          />
        </div>

        {!canEdit ? (
          <p className="flex items-start gap-2 rounded-card border border-border bg-surface-sunken px-4 py-3 text-sm text-muted">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-muted-strong">
                View only{coachName ? ` — coached by ${coachName}` : ""}.
              </span>{" "}
              You can read everything here and leave notes and check-in reviews.
              Changing their goals or tasks needs their coach to delegate edit
              access to you.
            </span>
          </p>
        ) : null}
      </header>

      <Tabs defaultValue="overview">
        <TabsList aria-label="Mentee detail">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="tasks">Core Tasks</TabsTrigger>
          <TabsTrigger value="check-ins">Check-Ins</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview ------------------------------------------------------- */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle as="h2">Score breakdown</CardTitle>
                <CardDescription>
                  Goals are half the score, daily tasks a third, consistency the
                  rest.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ProgressBar
                  label="Personal"
                  value={score.categories.PERSONAL}
                />
                <ProgressBar
                  label="Professional"
                  value={score.categories.PROFESSIONAL}
                />
                <ProgressBar
                  label="Contribution"
                  value={score.categories.CONTRIBUTION}
                />
                <ProgressBar label="Core tasks" value={score.coreTaskScore} />
                <ProgressBar
                  label="Consistency"
                  value={score.consistencyScore}
                />

                <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">
                      Goals done
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {score.goalsCompleted}/{score.goalsTotal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">
                      Longest streak
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {score.longestStreak} days
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">
                      Task rate
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 font-semibold tabular-nums",
                        TONE_TEXT[scoreTone(score.taskCompletionRate)],
                      )}
                    >
                      {formatScore(score.taskCompletionRate)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">
                      Check-in rate
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 font-semibold tabular-nums",
                        TONE_TEXT[scoreTone(score.checkInRate)],
                      )}
                    >
                      {formatScore(score.checkInRate)}%
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent>
                {trend.length === 0 ? (
                  <EmptyState
                    icon={Target}
                    title="No score history yet"
                    description="Scores are captured daily. The curve appears once the first snapshot lands."
                    className="border-0 bg-transparent"
                  />
                ) : (
                  <ScoreTrendChart
                    data={trend}
                    title="Score, last 30 days"
                    description="Overall, and the three parts it is made of."
                    height={280}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardContent>
                <CategoryRadarChart
                  data={categories.map((c) => ({
                    name: c.name,
                    score: c.score,
                  }))}
                  title="The three goal categories"
                  description="Personal, professional and contribution, side by side."
                  height={280}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Goals ---------------------------------------------------------- */}
        <TabsContent value="goals">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Goal Total Score</CardTitle>
                <CardDescription>
                  The three categories combined — half of {mentee.firstName}
                  &apos;s Overall Score. An empty category scores 0 rather than
                  being skipped.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
                <ScoreRing
                  score={goalStats.goalTotalScore}
                  size={116}
                  label="Goal Total Score"
                  sublabel="of 100"
                  className="shrink-0"
                />

                <div className="grid flex-1 gap-4 sm:grid-cols-3">
                  {GOAL_CATEGORY_KEYS.map((key) => {
                    const row = goalStats.byCategory[key];
                    // The weakest category is the one a coach should open the
                    // conversation with, so it is called out by name.
                    const dragging =
                      row.score ===
                      Math.min(
                        ...GOAL_CATEGORY_KEYS.map(
                          (k) => goalStats.byCategory[k].score,
                        ),
                      );

                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex flex-col gap-2 rounded-xl border p-4",
                          dragging
                            ? "border-rose-500/30 bg-rose-500/5"
                            : "border-border bg-surface-sunken",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-medium text-muted-strong">
                            {GOAL_CATEGORY_LABELS[key]}
                          </p>
                          <span
                            className={cn(
                              "text-lg font-semibold tabular-nums leading-none",
                              TONE_TEXT[scoreTone(row.score)],
                            )}
                          >
                            {formatScore(row.score)}
                          </span>
                        </div>

                        <ProgressBar value={row.score} showValue={false} />

                        <p className="text-xs text-muted">
                          {row.total === 0 ? (
                            <span className="font-medium text-rose-500 dark:text-rose-400">
                              No goal set — scoring 0
                            </span>
                          ) : (
                            `${row.total} ${row.total === 1 ? "goal" : "goals"} · ${row.completed} completed`
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {goals.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No goals set"
                description={`${mentee.firstName} has not set a goal yet. A goal in each of the three categories is the place to start.`}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {goals.map((goal) => (
                  <Card key={goal.id} className="flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {goal.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {goal.category.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusBadge status={goal.status} size="sm" />
                        <GoalScoreBadge score={goal.score} />
                      </div>
                    </div>

                    {goal.description ? (
                      <p className="line-clamp-2 text-sm leading-relaxed text-muted">
                        {goal.description}
                      </p>
                    ) : null}

                    {goal.score === null ? (
                      <p className="text-xs text-muted">
                        Withdrawn from scoring — an abandoned goal is left out of
                        the averages rather than counted as a zero.
                      </p>
                    ) : (
                      <ProgressBar value={goal.progress} label="Progress" />
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                      <span className="text-muted">
                        {goal.completedTasks}/{goal.taskCount} tasks
                      </span>
                      <span
                        className={cn(
                          goal.isOverdue
                            ? "font-medium text-rose-500 dark:text-rose-400"
                            : "text-muted",
                        )}
                      >
                        {goal.isOverdue ? "Overdue · " : "Due "}
                        {formatDate(goal.targetDate)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {!canEdit ? (
              <p className="text-xs text-muted">
                Read-only — goals can only be changed by{" "}
                {coachName ?? "their coach"}, or by a coach they have delegated
                edit access to.
              </p>
            ) : null}
          </div>
        </TabsContent>

        {/* Core tasks ----------------------------------------------------- */}
        <TabsContent value="tasks">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardContent>
                <TaskCompletionChart
                  data={tasks}
                  title="Daily core tasks, last 30 days"
                  description="A missing day is a zero, not a gap."
                  height={240}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Task by task</CardTitle>
                <CardDescription>
                  Which disciplines hold, and which slip.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {breakdown.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No core tasks configured"
                    description="An admin defines the organization's daily disciplines."
                    className="border-0 bg-transparent py-6"
                  />
                ) : (
                  breakdown.map((task) => (
                    <ProgressBar
                      key={task.key}
                      label={`${task.name} — ${task.completed}/${task.possible}`}
                      value={task.percent}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Streak history</CardTitle>
                <CardDescription>
                  Sixty days. A run of green is a streak; a hole is a missed day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StreakHeatmap data={streak} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Check-ins ------------------------------------------------------ */}
        <TabsContent value="check-ins">
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent>
                <MoodChart
                  data={moods}
                  title="Mood, last 30 days"
                  description="Days without a check-in are left blank rather than plotted as zero."
                  height={200}
                />
              </CardContent>
            </Card>

            {checkIns.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title="No check-ins yet"
                description={`${mentee.firstName} has not filed a daily check-in.`}
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {checkIns.map((checkIn) => (
                  <li key={checkIn.id}>
                    <Card className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {formatDate(checkIn.date)}
                        </p>
                        <Badge variant="neutral" size="sm">
                          {MOOD_LABELS[checkIn.mood] ?? `Mood ${checkIn.mood}`}
                        </Badge>
                      </div>

                      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                        {(
                          [
                            ["Wins", checkIn.wins],
                            ["Challenges", checkIn.challenges],
                            ["Lessons", checkIn.lessons],
                            ["Gratitude", checkIn.gratitude],
                            ["Tomorrow's focus", checkIn.tomorrowFocus],
                          ] as const
                        )
                          .filter(([, value]) => Boolean(value))
                          .map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-xs uppercase tracking-wide text-muted">
                                {label}
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                {value}
                              </dd>
                            </div>
                          ))}
                      </dl>

                      {checkIn.reviews.length > 0 ? (
                        <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                          {checkIn.reviews.map((review) => (
                            <li key={review.id} className="flex gap-3">
                              <Avatar
                                src={review.coach.avatarUrl}
                                firstName={review.coach.firstName}
                                lastName={review.coach.lastName}
                                size="xs"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted">
                                  {review.coach.firstName}{" "}
                                  {review.coach.lastName} ·{" "}
                                  {formatDateTime(review.createdAt)}
                                </p>
                                <p className="mt-0.5 text-sm leading-relaxed text-foreground">
                                  {review.comment}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <ReviewBox
                        checkInId={checkIn.id}
                        menteeId={mentee.id}
                        menteeFirstName={mentee.firstName}
                      />
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* Notes ---------------------------------------------------------- */}
        <TabsContent value="notes">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Coaching notes
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Your own notes, plus the notes colleagues chose to share.
                </p>
              </div>
              <NewNoteButton
                menteeId={mentee.id}
                firstName={mentee.firstName}
                lastName={mentee.lastName}
              />
            </div>

            {notes.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title="No notes on this mentee"
                description="A note is the one thing you may write about a mentee you do not coach."
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {notes.map((note) => (
                  <li key={note.id}>
                    <Card className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {note.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {note.coach.firstName} {note.coach.lastName} ·{" "}
                            {formatRelative(note.createdAt)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {note.followUpDate ? (
                            <Badge variant="info" size="sm">
                              Follow up {formatDate(note.followUpDate)}
                            </Badge>
                          ) : null}
                          <Badge
                            variant={
                              note.visibility === "SHARED"
                                ? "success"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {note.visibility === "SHARED" ? (
                              <Eye aria-hidden="true" />
                            ) : (
                              <Lock aria-hidden="true" />
                            )}
                            {note.visibility === "SHARED"
                              ? "Shared"
                              : "Private"}
                          </Badge>
                        </div>
                      </div>

                      {note.body ? (
                        // Allow-list sanitized on write by sanitizeNoteHtml()
                        // in src/server/notes.ts — never re-sanitized here.
                        <div
                          className="mt-3 text-sm leading-relaxed text-muted-strong [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_li]:list-disc"
                          dangerouslySetInnerHTML={{ __html: note.body }}
                        />
                      ) : null}

                      {note.actionItems.length > 0 ? (
                        <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                          {note.actionItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span
                                className={cn(
                                  "size-4 shrink-0 rounded border",
                                  item.isDone
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-border",
                                )}
                                aria-hidden="true"
                              />
                              <span
                                className={cn(
                                  item.isDone
                                    ? "text-muted line-through"
                                    : "text-foreground",
                                )}
                              >
                                {item.title}
                              </span>
                              {item.dueDate ? (
                                <span className="ml-auto text-xs text-muted">
                                  {formatDate(item.dueDate)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
