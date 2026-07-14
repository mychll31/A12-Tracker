import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flame,
  Inbox,
  ListChecks,
  Sparkles,
  Target,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { getCoachDashboard } from "@/server/dashboard";
import { daysBetween, formatDate, formatRelative } from "@/lib/dates";
import { cn, formatScore, ordinal, scoreTone, TONE_TEXT } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  StatCard,
} from "@/components/ui";
import { AreaTrendChart } from "@/components/charts";

import { MenteeTable } from "./mentee-table";

export const metadata: Metadata = { title: "Coach Dashboard" };

/** Matches the AT_RISK_SCORE the dashboard layer scores against. */
const AT_RISK_SCORE = 40;
const STALE_DAYS = 7;

/** Says *why* a mentee is flagged — a flag with no reason is not actionable. */
function riskReason(mentee: {
  overallScore: number;
  lastActiveAt: Date | null;
}): string {
  const reasons: string[] = [];

  if (mentee.overallScore < AT_RISK_SCORE) {
    reasons.push(`score ${formatScore(mentee.overallScore)}`);
  }

  if (!mentee.lastActiveAt) {
    reasons.push("never active");
  } else {
    const idle = daysBetween(mentee.lastActiveAt, new Date());
    if (idle > STALE_DAYS) reasons.push(`inactive ${idle} days`);
  }

  return reasons.join(" · ") || "needs a conversation";
}

export default async function CoachDashboardPage() {
  const user = await requireCoach();
  const data = await getCoachDashboard(user);

  const { totals } = data;
  const atRisk = data.mentees.filter((m) => m.isAtRisk);

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Coach Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Where your people stand today — and who needs you first.
        </p>
      </header>

      <section
        aria-label="Coaching totals"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Total mentees"
          value={totals.mentees}
          icon={Users}
          href="/coach/mentees"
        />
        <StatCard
          label="Active mentees"
          value={totals.activeMentees}
          icon={Activity}
          deltaLabel="in the last 7 days"
        />
        <StatCard
          label="Coaching groups"
          value={totals.groups}
          icon={UsersRound}
          href="/coach/groups"
        />
        <StatCard
          label="Average group score"
          value={formatScore(totals.avgGroupScore)}
          icon={Trophy}
          tone={scoreTone(totals.avgGroupScore)}
        />
        <StatCard
          label="Goal completion"
          value={`${formatScore(totals.goalCompletionRate)}%`}
          icon={Target}
          tone={scoreTone(totals.goalCompletionRate)}
        />
        <StatCard
          label="Core task completion"
          value={`${formatScore(totals.coreTaskCompletion)}%`}
          icon={ListChecks}
          tone={scoreTone(totals.coreTaskCompletion)}
        />
        <StatCard
          label="Check-ins this week"
          value={totals.checkInsThisWeek}
          icon={CheckCircle2}
        />
        <StatCard
          label="Pending reviews"
          value={totals.pendingReviews}
          icon={Inbox}
          tone={totals.pendingReviews > 0 ? "warning" : undefined}
        />
      </section>

      <Card
        className={cn(
          atRisk.length > 0 &&
            "border-amber-500/40 ring-1 ring-inset ring-amber-500/10",
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle as="h2" className="flex items-center gap-2">
                <AlertTriangle
                  className="size-4 text-amber-500"
                  aria-hidden="true"
                />
                Needs attention
              </CardTitle>
              <CardDescription>
                A low score or a long silence. Start here.
              </CardDescription>
            </div>
            {atRisk.length > 0 ? (
              <Badge variant="warning">{atRisk.length}</Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {atRisk.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Everyone is on track"
              description="No mentee is below the risk line or has gone quiet this week."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {atRisk.map((mentee) => (
                <li key={mentee.id}>
                  <Link
                    href={`/coach/mentees/${mentee.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border bg-surface p-3",
                      "transition-colors hover:border-border-strong hover:bg-surface-sunken",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    )}
                  >
                    <Avatar
                      src={mentee.avatarUrl}
                      firstName={mentee.firstName}
                      lastName={mentee.lastName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {mentee.firstName} {mentee.lastName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {mentee.groupName ?? "No group"} · {riskReason(mentee)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        TONE_TEXT[scoreTone(mentee.overallScore)],
                      )}
                    >
                      {formatScore(mentee.overallScore)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2">Your mentees</CardTitle>
            <CardDescription>
              Every mentee across the groups you lead, strongest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MenteeTable mentees={data.mentees} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Your standing</CardTitle>
            <CardDescription>
              Coaches are ranked on the average score of the mentees they lead.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums text-primary">
                {data.coachRank ? ordinal(data.coachRank.rank) : "—"}
              </span>
              {data.coachRank ? (
                <span className="text-sm text-muted">
                  of {data.coachRank.total} coaches
                </span>
              ) : (
                <span className="text-sm text-muted">not yet ranked</span>
              )}
            </div>

            {data.trend.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No history yet"
                description="Your mentees' average score is captured daily — the curve appears after the first snapshot."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <AreaTrendChart
                data={data.trend}
                dataKey="averageScore"
                label="Average score"
                title="Your mentees, 30 days"
                height={200}
              />
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  Notes this month
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {totals.notesThisMonth}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  Groups led
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {totals.groups}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2">Coaching groups</CardTitle>
            <CardDescription>
              The groups you lead, by average score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.groups.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="You lead no groups yet"
                description="Create a group and start placing mentees into it."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.groups.map((group) => {
                  const tone = scoreTone(group.averageScore);
                  return (
                    <li key={group.id}>
                      <Link
                        href={`/coach/groups/${group.id}`}
                        className={cn(
                          "flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4",
                          "transition-colors hover:border-border-strong hover:bg-surface-sunken",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        )}
                      >
                        <p className="font-medium text-foreground">
                          {group.name}
                        </p>
                        <div className="mt-auto flex items-baseline justify-between gap-3">
                          <span className="text-xs text-muted">
                            {group.memberCount}{" "}
                            {group.memberCount === 1 ? "member" : "members"}
                          </span>
                          <span
                            className={cn(
                              "text-lg font-semibold tabular-nums",
                              TONE_TEXT[tone],
                            )}
                          >
                            {formatScore(group.averageScore)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted" aria-hidden="true" />
              Follow-ups due
            </CardTitle>
            <CardDescription>
              Notes you promised to come back to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.followUps.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Nothing scheduled"
                description="Set a follow-up date on a note and it lands here."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {data.followUps.map((followUp) => (
                  <li key={followUp.id}>
                    <Link
                      href={`/coach/mentees/${followUp.menteeId}`}
                      className="-m-2 flex items-start justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {followUp.title}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {followUp.menteeName}
                        </p>
                      </div>
                      <Badge variant="neutral" size="sm">
                        {formatDate(followUp.followUpDate)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Flame className="size-4 text-muted" aria-hidden="true" />
            Recent activity
          </CardTitle>
          <CardDescription>
            What your mentees have been doing, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nothing yet"
              description="Goals, tasks and check-ins from your mentees will show up here."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <Avatar
                    src={item.user.avatarUrl}
                    firstName={item.user.firstName}
                    lastName={item.user.lastName}
                    size="xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-foreground">
                      <Link
                        href={`/coach/mentees/${item.user.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {item.user.firstName} {item.user.lastName}
                      </Link>{" "}
                      <span className="text-muted">{item.summary}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatRelative(item.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
