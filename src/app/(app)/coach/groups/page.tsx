import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { listGroups, listMentees } from "@/server/mentees";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";
import { Avatar, AvatarGroup, Badge, Card, EmptyState } from "@/components/ui";

import { NewGroupButton } from "./group-actions";

export const metadata: Metadata = { title: "Coaching Groups" };

type GroupMember = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export default async function GroupsPage() {
  const user = await requireCoach();

  // One roster read, bucketed by group — `listGroups` returns counts but not
  // members, and a getGroup() per card would be one query per group.
  const [groups, mentees] = await Promise.all([
    listGroups(user),
    listMentees(user),
  ]);

  const membersByGroup = new Map<string, GroupMember[]>();

  for (const mentee of mentees) {
    if (!mentee.groupId) continue;
    const bucket = membersByGroup.get(mentee.groupId) ?? [];
    bucket.push(mentee);
    membersByGroup.set(mentee.groupId, bucket);
  }

  const mine = new Set(user.coachGroupIds);

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Coaching Groups
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every group in the organization, and how each one is doing.
          </p>
        </div>

        <NewGroupButton />
      </header>

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Create the first coaching group and start placing mentees into it."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const tone = scoreTone(group.averageScore);
            const members = membersByGroup.get(group.id) ?? [];
            const isMine = mine.has(group.id);

            return (
              <Card
                key={group.id}
                className={cn(
                  "flex flex-col gap-4 p-5 transition-colors hover:border-border-strong",
                  !isMine && "border-dashed bg-surface-raised/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/coach/groups/${group.id}`}
                      className="font-semibold text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {group.name}
                    </Link>
                    {group.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                        {group.description}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={cn(
                      "shrink-0 text-2xl font-semibold tabular-nums",
                      TONE_TEXT[tone],
                    )}
                  >
                    {formatScore(group.averageScore)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted">
                  <Avatar
                    src={group.coach.avatarUrl}
                    firstName={group.coach.firstName}
                    lastName={group.coach.lastName}
                    size="xs"
                  />
                  <span className="truncate">
                    {group.coach.firstName} {group.coach.lastName}
                  </span>
                  {isMine ? (
                    <Badge variant="primary" size="sm" className="ml-auto">
                      Yours
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                  {members.length > 0 ? (
                    <AvatarGroup max={5}>
                      {members.map((member) => (
                        <Avatar
                          key={member.id}
                          src={member.avatarUrl}
                          firstName={member.firstName}
                          lastName={member.lastName}
                          size="sm"
                        />
                      ))}
                    </AvatarGroup>
                  ) : (
                    <span className="text-xs text-muted">No members yet</span>
                  )}

                  <span className="whitespace-nowrap text-xs text-muted">
                    {group.memberCount}{" "}
                    {group.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
