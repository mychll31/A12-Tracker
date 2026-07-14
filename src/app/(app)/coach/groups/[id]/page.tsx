import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, TrendingUp, Trophy } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { getGroup, listMentees } from "@/server/mentees";
import { groupTrend } from "@/server/analytics";
import { getLeaderboard } from "@/server/leaderboards";
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
} from "@/components/ui";
import { AreaTrendChart } from "@/components/charts";

import { MenteeTable } from "../../mentee-table";
import { AddMenteeButton } from "../group-actions";

export const metadata: Metadata = { title: "Coaching Group" };

const TREND_DAYS = 30;

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCoach();
  const { id } = await params;

  let group;
  try {
    group = await getGroup(user, id);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <EmptyState
          icon={ShieldAlert}
          title="You cannot open this group"
          description={error.message}
          action={
            <Link
              href="/coach/groups"
              className="text-sm font-medium text-primary hover:underline"
            >
              Back to groups
            </Link>
          }
        />
      );
    }
    throw error;
  }

  // Only the coach who runs a group (or an admin) may place people into it.
  const canManage = user.isAdmin || user.coachGroupIds.includes(id);

  const [trend, board, roster] = await Promise.all([
    groupTrend(user, id, TREND_DAYS),
    getLeaderboard(user, "GROUP", id),
    canManage ? listMentees(user) : Promise.resolve([]),
  ]);

  const candidates = roster
    .filter((mentee) => mentee.groupId !== id)
    .map(({ id: menteeId, firstName, lastName }) => ({
      id: menteeId,
      firstName,
      lastName,
    }));

  const tone = scoreTone(group.averageScore);

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <Link
          href="/coach/groups"
          className="w-fit text-xs text-muted hover:text-foreground"
        >
          ← All groups
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {group.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {group.description ?? "No description for this group."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Avatar
                  src={group.coach.avatarUrl}
                  firstName={group.coach.firstName}
                  lastName={group.coach.lastName}
                  size="xs"
                />
                {group.coach.firstName} {group.coach.lastName}
              </span>
              <span>
                {group.members.length}{" "}
                {group.members.length === 1 ? "member" : "members"}
              </span>
              <span className={cn("font-semibold", TONE_TEXT[tone])}>
                {formatScore(group.averageScore)} average
              </span>
            </div>
          </div>

          {canManage ? (
            <AddMenteeButton groupId={id} candidates={candidates} />
          ) : (
            <Badge variant="neutral">View only</Badge>
          )}
        </div>
      </header>

      <Card>
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No group history yet"
              description="A group's average score is captured daily. The curve appears once the first snapshot lands."
              className="border-0 bg-transparent"
            />
          ) : (
            <AreaTrendChart
              data={trend}
              dataKey="averageScore"
              label="Average score"
              title="Group score, last 30 days"
              description="The average of every member's overall score."
              height={240}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Members</CardTitle>
          <CardDescription>
            Everyone currently in this group, strongest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MenteeTable
            mentees={group.members}
            showGroup={false}
            emptyTitle="No members yet"
            emptyDescription={
              canManage
                ? "Add a mentee to this group and they will appear here."
                : "This group has no members yet."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Trophy className="size-4 text-muted" aria-hidden="true" />
            Group leaderboard
          </CardTitle>
          <CardDescription>
            Ranked on overall score. A delta is movement against the last
            captured board.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {board.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Nobody to rank"
              description="A leaderboard needs at least one member."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {board.map((row) => (
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
                    {row.secondary ? (
                      <p className="truncate text-xs text-muted">
                        {row.secondary}
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
