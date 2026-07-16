import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Flag,
  Lock,
  MessageSquareQuote,
  Paperclip,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar, ScoreRing } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { formatDate, formatRelative, isoDay } from "@/lib/dates";
import { TARGET_PERIOD_LABELS } from "@/lib/domain";
import { ForbiddenError } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { getGoal, type GoalDetail } from "@/server/goals";

import { GOAL_CATEGORY_LABELS } from "../categories";
import { GoalScoreBadge } from "../goal-score-badge";
import { GoalRankMedal } from "../goal-rank-medal";
import { CommentForm } from "./comment-form";
import { GoalControls } from "./goal-controls";
import { MeasureControl } from "./measure-control";
import { TaskList } from "./task-list";

export const metadata: Metadata = { title: "Goal" };

const KB = 1024;

function formatBytes(size: number): string {
  if (size < KB) return `${size} B`;
  if (size < KB * KB) return `${Math.round(size / KB)} KB`;
  return `${(size / (KB * KB)).toFixed(1)} MB`;
}

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let goal: GoalDetail;
  try {
    goal = await getGoal(user, id);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;

    return (
      <EmptyState
        icon={ShieldAlert}
        title="You cannot open this goal"
        description={error.message}
        action={
          <Link
            href="/goals"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to my goals
          </Link>
        }
      />
    );
  }

  const canPostPrivate = user.isCoach || user.isAdmin;

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <div>
        <Link
          href="/goals"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          My goals
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {goal.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              {GOAL_CATEGORY_LABELS[goal.category.key]}
            </Badge>
            <StatusBadge status={goal.status} />
            <GoalScoreBadge score={goal.score} size="md" />
            <GoalRankMedal score={goal.score} size="md" />
            {goal.goalType === "MILESTONE" ? (
              <Badge variant="neutral">Milestone</Badge>
            ) : goal.targetValue > 0 ? (
              <Badge variant="neutral">
                {goal.direction === "LOSE" ? "Lose" : "Gain"} {goal.targetValue}
                {goal.unit ? ` ${goal.unit}` : ""}
              </Badge>
            ) : null}
            {goal.goalType === "MERIT" && goal.targetPeriod !== "NONE" ? (
              <Badge variant="info">
                {TARGET_PERIOD_LABELS[goal.targetPeriod]} · {goal.periodTarget}
                {goal.unit ? ` ${goal.unit}` : ""}
              </Badge>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                goal.isOverdue
                  ? "font-medium text-rose-500 dark:text-rose-400"
                  : "text-muted",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Target {formatDate(goal.targetDate)}
              <span aria-hidden="true">·</span>
              {goal.isOverdue
                ? `${Math.abs(goal.daysUntilDue)}d overdue`
                : goal.daysUntilDue === 0
                  ? "due today"
                  : `${goal.daysUntilDue}d left`}
            </span>
          </div>
        </div>

        <GoalControls
          goal={{
            id: goal.id,
            title: goal.title,
            description: goal.description,
            notes: goal.notes,
            status: goal.status,
            targetDate: isoDay(goal.targetDate),
            goalType: goal.goalType,
            targetPeriod: goal.targetPeriod,
            direction: goal.direction,
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            unit: goal.unit,
          }}
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Goal Score</CardTitle>
              <CardDescription>
                {goal.score === null
                  ? "This goal is abandoned — withdrawn from your scores rather than counted as a zero."
                  : goal.goalType === "MILESTONE"
                    ? "How far your action plans are done — in progress counts half."
                    : "How far your current value has come toward the target."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                {goal.score === null ? (
                  <div className="flex size-[116px] shrink-0 flex-col items-center justify-center gap-1 rounded-full bg-surface-sunken">
                    <span className="text-3xl font-semibold leading-none text-muted">
                      —
                    </span>
                    <span className="text-[0.6875rem] font-medium text-muted">
                      Not scored
                    </span>
                  </div>
                ) : (
                  <ScoreRing
                    score={goal.score}
                    size={116}
                    label="Goal Score"
                    sublabel="of 100"
                  />
                )}

                {goal.goalType === "MILESTONE" ? (
                  <div className="w-full min-w-0 flex-1">
                    <p className="text-sm text-muted">
                      Scored by the action plans below — currently{" "}
                      <span className="font-semibold text-foreground">
                        {goal.planCompletion}%
                      </span>{" "}
                      done. Move a plan to done (or in progress) and the score
                      follows.
                    </p>
                    <ProgressBar
                      value={goal.score ?? 0}
                      showValue={false}
                      className="mt-3"
                    />
                  </div>
                ) : (
                  <MeasureControl
                    goalId={goal.id}
                    direction={goal.direction}
                    targetValue={goal.targetValue}
                    currentValue={goal.currentValue}
                    unit={goal.unit}
                    progress={goal.progress}
                  />
                )}
              </div>

              <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">Started</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDate(goal.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Target date</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDate(goal.targetDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Completed</dt>
                  <dd className="mt-0.5 font-medium">
                    {goal.completedAt ? formatDate(goal.completedAt) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Action plans</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {goal.completedTasks}/{goal.taskCount} done
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {goal.description || goal.notes ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">The commitment</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {goal.description ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {goal.description}
                  </p>
                ) : null}

                {goal.notes ? (
                  <div className="rounded-xl bg-surface-sunken p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Notes
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                      {goal.notes}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Action Plans</CardTitle>
              <CardDescription>
                {goal.goalType === "MILESTONE"
                  ? "These plans are the goal — its score is how far they're done. Click a status to move it between not started, in progress and done."
                  : "The steps toward this goal. Click a status to move it between not started, in progress and done — shown here, but the score comes from the measure above."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskList
                goalId={goal.id}
                plans={goal.tasks.map((plan) => ({
                  id: plan.id,
                  title: plan.title,
                  status: plan.status,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Comments</CardTitle>
              <CardDescription>
                Your coach&apos;s feedback, and your replies.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {goal.comments.length ? (
                <ul className="flex flex-col gap-5">
                  {goal.comments.map((comment) => (
                    <li key={comment.id} className="flex gap-3">
                      <Avatar
                        size="sm"
                        src={comment.author.avatarUrl}
                        firstName={comment.author.firstName}
                        lastName={comment.author.lastName}
                      />
                      <div
                        className={cn(
                          "min-w-0 flex-1 rounded-xl px-3.5 py-3",
                          comment.isPrivate
                            ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/20"
                            : "bg-surface-sunken",
                        )}
                      >
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <span className="font-medium text-foreground">
                            {comment.author.firstName} {comment.author.lastName}
                          </span>
                          <span>{formatRelative(comment.createdAt)}</span>
                          {comment.isPrivate ? (
                            <Badge size="sm" variant="warning">
                              <Lock aria-hidden="true" />
                              Coach only
                            </Badge>
                          ) : null}
                        </p>
                        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                          {comment.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={MessageSquareQuote}
                  title="No comments yet"
                  description="Start the thread — your coach gets a notification."
                />
              )}

              <CommentForm goalId={goal.id} canPostPrivate={canPostPrivate} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Progress history</CardTitle>
              <CardDescription>Every movement, in order.</CardDescription>
            </CardHeader>
            <CardContent>
              {goal.updates.length ? (
                <ol className="flex flex-col gap-4">
                  {goal.updates.map((update) => {
                    const rose = update.progressTo < update.progressFrom;
                    const completed = update.statusTo === "COMPLETED";

                    return (
                      <li key={update.id} className="flex gap-3">
                        <span
                          className={cn(
                            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                            completed
                              ? "bg-emerald-500/10 text-emerald-500"
                              : rose
                                ? "bg-rose-500/10 text-rose-500"
                                : "bg-primary-soft text-primary",
                          )}
                        >
                          {completed ? (
                            <CheckCircle2
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <TrendingUp
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium tabular-nums">
                            {update.progressFrom}% → {update.progressTo}%
                          </p>
                          {update.statusTo &&
                          update.statusTo !== update.statusFrom ? (
                            <p className="mt-1">
                              <StatusBadge size="sm" status={update.statusTo} />
                            </p>
                          ) : null}
                          {update.note ? (
                            <p className="mt-1 text-xs leading-relaxed text-muted">
                              {update.note}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted">
                            {update.author.firstName} {update.author.lastName} ·{" "}
                            {formatRelative(update.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No movement yet"
                  description="Tick a task or change the status and it shows up here."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Attachments</CardTitle>
              <CardDescription>Proof, plans and references.</CardDescription>
            </CardHeader>
            <CardContent>
              {goal.attachments.length ? (
                <ul className="flex flex-col divide-y divide-border">
                  {goal.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Paperclip
                          className="size-4 shrink-0 text-muted"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {attachment.fileName}
                          </span>
                          <span className="block text-xs text-muted">
                            {formatBytes(attachment.size)} ·{" "}
                            {formatDate(attachment.createdAt)}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Flag}
                  title="Nothing attached"
                  description="Files linked to this goal will appear here."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
