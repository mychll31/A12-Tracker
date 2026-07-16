import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { getOrgDashboard } from "@/server/dashboard";
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
  ScoreRing,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { AreaTrendChart, ComparisonBarChart } from "@/components/charts";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  // getOrgDashboard throws ForbiddenError for a mentee; requireCoach redirects
  // them to their own dashboard before it can.
  const user = await requireCoach();
  const data = await getOrgDashboard(user);

  const { totals, growth } = data;

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Organization
        </h1>
        <p className="mt-1 text-sm text-muted">
          How the whole organization is performing — and which coaches are
          moving it.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <ScoreRing
            score={totals.orgScore}
            size={148}
            strokeWidth={12}
            sublabel="Org score"
          />
          <p className="text-center text-xs text-muted">
            The average overall score across all {totals.totalMembers} members.
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total coaches" value={totals.coaches} icon={Users} />
          <StatCard
            label="Total mentees"
            value={totals.mentees}
            icon={UsersRound}
          />
          <StatCard
            label="Active members"
            value={totals.activeMembers}
            icon={Activity}
            deltaLabel="in the last 7 days"
          />
          <StatCard
            label="Goal completion"
            value={`${formatScore(totals.goalCompletionRate)}%`}
            icon={Target}
            tone={scoreTone(totals.goalCompletionRate)}
          />
          <StatCard
            label="Task completion"
            value={`${formatScore(totals.taskCompletionRate)}%`}
            icon={ListChecks}
            tone={scoreTone(totals.taskCompletionRate)}
          />
          <StatCard
            label="Total members"
            value={totals.totalMembers}
            icon={Sparkles}
          />
        </div>
      </section>

      <section aria-label="Growth this month" className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Growth this month
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Counted from the first of the month.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="New members"
            value={growth.newMembersThisMonth}
            icon={UserPlus}
          />
          <StatCard
            label="Goals completed"
            value={growth.goalsCompletedThisMonth}
            icon={Target}
          />
          <StatCard
            label="Check-ins filed"
            value={growth.checkInsThisMonth}
            icon={CheckCircle2}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            {data.trend.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No history yet"
                description="Organization scores are captured daily. The curve appears once the first snapshot lands."
                className="border-0 bg-transparent"
              />
            ) : (
              <AreaTrendChart
                data={data.trend}
                dataKey="averageScore"
                label="Average score"
                title="Organization score, 30 days"
                description="Every member's overall score, averaged."
                height={240}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {data.trend.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No history yet"
                description="Goal completion is captured daily alongside the score."
                className="border-0 bg-transparent"
              />
            ) : (
              <AreaTrendChart
                data={data.trend}
                dataKey="goalCompletionRate"
                label="Goal completion"
                color="#10b981"
                title="Goal completion, 30 days"
                description="Goals carried all the way to done, as a share of goals set."
                height={240}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Trophy className="size-4 text-muted" aria-hidden="true" />
            Coach rankings
          </CardTitle>
          <CardDescription>
            A coach is measured on the average score of the mentees they lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {data.coaches.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No coaches yet"
              description="Once a coach leads a council they appear in this comparison."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <>
              <ComparisonBarChart
                data={data.coaches.map((row) => ({
                  name: `${row.coach.firstName} ${row.coach.lastName.charAt(0)}.`,
                  value: row.averageScore,
                }))}
                title="Coaches head to head"
                description="Average mentee score, highest first."
              />

              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Rank</TH>
                    <TH>Coach</TH>
                    <TH>Councils</TH>
                    <TH className="text-right">Mentees</TH>
                    <TH className="text-right">Active</TH>
                    <TH className="text-right">Average score</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.coaches.map((row, index) => (
                    <TR key={row.coach.id}>
                      <TD className="tabular-nums text-muted">
                        {ordinal(index + 1)}
                      </TD>
                      <TD>
                        <span className="flex items-center gap-3">
                          <Avatar
                            src={row.coach.avatarUrl}
                            firstName={row.coach.firstName}
                            lastName={row.coach.lastName}
                            size="sm"
                          />
                          <span className="font-medium">
                            {row.coach.firstName} {row.coach.lastName}
                          </span>
                          {row.coach.id === user.id ? (
                            <Badge variant="primary" size="sm">
                              You
                            </Badge>
                          ) : null}
                        </span>
                      </TD>
                      <TD className="text-muted">
                        {row.groupNames.length > 0
                          ? row.groupNames.join(", ")
                          : "—"}
                      </TD>
                      <TD className="text-right tabular-nums text-muted-strong">
                        {row.menteeCount}
                      </TD>
                      <TD className="text-right tabular-nums text-muted-strong">
                        {row.activeCount}
                      </TD>
                      <TD
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          TONE_TEXT[scoreTone(row.averageScore)],
                        )}
                      >
                        {formatScore(row.averageScore)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Trophy className="size-4 text-muted" aria-hidden="true" />
            Overall leaderboard
          </CardTitle>
          <CardDescription>
            The top ten members of the organization, by overall score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.topMembers.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Nobody to rank"
              description="A leaderboard needs at least one scored member."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.topMembers.map((row) => (
                <li
                  key={row.user.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-surface p-3",
                    row.isCurrentUser && "border-primary/40 bg-primary-soft",
                  )}
                >
                  <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-muted">
                    {ordinal(row.rank)}
                  </span>

                  <Avatar
                    src={row.user.avatarUrl}
                    firstName={row.user.firstName}
                    lastName={row.user.lastName}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/coach/mentees/${row.user.id}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      {row.user.firstName} {row.user.lastName}
                    </Link>
                    {row.user.headline ? (
                      <p className="truncate text-xs text-muted">
                        {row.user.headline}
                      </p>
                    ) : null}
                  </div>

                  {row.delta !== null && row.delta !== 0 ? (
                    <Badge
                      variant={row.delta > 0 ? "success" : "danger"}
                      size="sm"
                    >
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </Badge>
                  ) : null}

                  <span
                    className={cn(
                      "w-12 shrink-0 text-right text-sm font-semibold tabular-nums",
                      TONE_TEXT[scoreTone(row.score)],
                    )}
                  >
                    {formatScore(row.score)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
