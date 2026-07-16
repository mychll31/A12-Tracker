import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Flame, Search, Users } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { listGroups, listMentees, type MenteeCard } from "@/server/mentees";
import { formatRelative } from "@/lib/dates";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ScoreRing,
  Select,
} from "@/components/ui";

export const metadata: Metadata = { title: "Mentees" };

/**
 * The org-wide roster. A coach may read every group — the spec is explicit that
 * "Coaches can view the members of other coaches" — so the filter defaults to
 * everyone and the cards say plainly whose mentee each person is.
 */

type SearchParams = Promise<{ groupId?: string; search?: string }>;

function MenteeGridCard({
  mentee,
  isMine,
}: {
  mentee: MenteeCard;
  isMine: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-5 transition-colors hover:border-border-strong",
        // A mentee you cannot edit reads quieter than one you can.
        !isMine && "border-dashed bg-surface-raised/60",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={mentee.avatarUrl}
          firstName={mentee.firstName}
          lastName={mentee.lastName}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <Link
            href={`/coach/mentees/${mentee.id}`}
            className="truncate font-semibold text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {mentee.firstName} {mentee.lastName}
          </Link>

          {mentee.headline ? (
            <p className="mt-0.5 truncate text-xs text-muted">
              {mentee.headline}
            </p>
          ) : null}

          <p className="mt-1 truncate text-xs text-muted">
            {mentee.groupName ?? "No group"}
            {mentee.coachName && !isMine ? (
              <> · Coached by {mentee.coachName}</>
            ) : null}
          </p>
        </div>

        <ScoreRing score={mentee.overallScore} size={52} strokeWidth={5} />
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted">
            Streak
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <Flame
              className={cn(
                "size-3.5",
                mentee.currentStreak > 0 ? "text-amber-500" : "text-muted/40",
              )}
              aria-hidden="true"
            />
            {mentee.currentStreak}
          </p>
        </div>
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted">
            Goals
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {mentee.goalsCompleted}/{mentee.goalsTotal}
          </p>
        </div>
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted">
            Tasks
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              TONE_TEXT[scoreTone(mentee.taskCompletionRate)],
            )}
          >
            {Math.round(mentee.taskCompletionRate)}%
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {mentee.lastActiveAt
            ? `Active ${formatRelative(mentee.lastActiveAt)}`
            : "Never active"}
        </span>

        <div className="flex items-center gap-1.5">
          {mentee.isAtRisk ? (
            <Badge variant="danger" size="sm">
              <AlertTriangle aria-hidden="true" />
              At risk
            </Badge>
          ) : null}
          <Badge variant={isMine ? "primary" : "neutral"} size="sm">
            {isMine ? "Yours" : "View only"}
          </Badge>
        </div>
      </div>

      <span className="sr-only">
        Overall score {formatScore(mentee.overallScore)} out of 100.
      </span>
    </Card>
  );
}

export default async function MenteesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireCoach();
  const { groupId, search } = await searchParams;

  const [mentees, groups] = await Promise.all([
    listMentees(user, { groupId, search }),
    listGroups(user),
  ]);

  const mine = new Set(user.coachGroupIds);
  const isMine = (mentee: MenteeCard) =>
    Boolean(mentee.groupId && mine.has(mentee.groupId));

  const yours = mentees.filter(isMine);
  const others = mentees.filter((m) => !isMine(m));

  const groupOptions = [
    { value: "", label: "All groups" },
    ...groups.map((group) => ({
      value: group.id,
      label: `${group.name} — ${group.coach.firstName} ${group.coach.lastName}`,
    })),
  ];

  const filtered = Boolean(search || groupId);

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Mentees
        </h1>
        <p className="mt-1 text-sm text-muted">
          Everyone in the organization. You can open any of them; you can only
          edit your own.
        </p>
      </header>

      {/* A plain GET form: the filter state lives in the URL, so a filtered
          roster is a link a coach can share or bookmark. */}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end [&>*]:min-w-0"
        role="search"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="mentee-search"
            className="text-sm font-medium text-muted-strong"
          >
            Search
          </label>
          <Input
            id="mentee-search"
            name="search"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Name or email"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:w-72">
          <label
            htmlFor="mentee-group"
            className="text-sm font-medium text-muted-strong"
          >
            Group
          </label>
          <Select
            id="mentee-group"
            name="groupId"
            options={groupOptions}
            defaultValue={groupId ?? ""}
          />
        </div>

        <Button type="submit" icon={<Search />}>
          Filter
        </Button>
      </form>

      {mentees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No mentees match"
          description={
            filtered
              ? "Try a different name, or widen the filter to all groups."
              : "No mentee has been added to this organization yet."
          }
          action={
            filtered ? (
              <Link
                href="/coach/mentees"
                className="text-sm font-medium text-primary hover:underline"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">
                Your mentees
              </h2>
              <span className="text-xs text-muted">{yours.length}</span>
            </div>

            {yours.length === 0 ? (
              <EmptyState
                icon={Users}
                title="None of these are yours"
                description="The people below sit in other coaches' groups. You can read them, but not edit them."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                {yours.map((mentee) => (
                  <MenteeGridCard key={mentee.id} mentee={mentee} isMine />
                ))}
              </div>
            )}
          </section>

          {others.length > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Other coaches&rsquo; mentees
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Visible to you, but editing one requires their coach to
                    delegate access.
                  </p>
                </div>
                <span className="text-xs text-muted">{others.length}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                {others.map((mentee) => (
                  <MenteeGridCard
                    key={mentee.id}
                    mentee={mentee}
                    isMine={false}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
