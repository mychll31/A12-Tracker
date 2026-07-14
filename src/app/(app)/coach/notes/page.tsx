import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardList } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { listNotesByCoach, upcomingFollowUps } from "@/server/notes";
import { listMentees } from "@/server/mentees";
import { formatDate, formatRelative } from "@/lib/dates";
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

import { NotesBrowser } from "./notes-browser";

export const metadata: Metadata = { title: "Coaching Notes" };

/** The window `upcomingFollowUps` defaults to — stated here so the copy matches. */
const FOLLOW_UP_DAYS = 7;

export default async function CoachNotesPage() {
  const user = await requireCoach();

  const [notes, followUps, mentees] = await Promise.all([
    listNotesByCoach(user, user.id),
    upcomingFollowUps(user, user.id, FOLLOW_UP_DAYS),
    listMentees(user),
  ]);

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Coaching Notes
        </h1>
        <p className="mt-1 text-sm text-muted">
          Everything you have written, across every mentee you have written
          about.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted" aria-hidden="true" />
            Follow-ups due
          </CardTitle>
          <CardDescription>
            Notes you set a follow-up date on, inside the next {FOLLOW_UP_DAYS}{" "}
            days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nothing due"
              description="Set a follow-up date on a note and it will surface here when it comes round."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {followUps.map((followUp) => (
                <li key={followUp.id}>
                  <Link
                    href={`/coach/mentees/${followUp.mentee.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Avatar
                      src={followUp.mentee.avatarUrl}
                      firstName={followUp.mentee.firstName}
                      lastName={followUp.mentee.lastName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {followUp.title}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {followUp.mentee.firstName} {followUp.mentee.lastName} ·{" "}
                        {formatRelative(followUp.followUpDate)}
                      </p>
                    </div>
                    <Badge variant="info" size="sm">
                      {formatDate(followUp.followUpDate)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NotesBrowser
        notes={notes}
        coachId={user.id}
        mentees={mentees.map(({ id, firstName, lastName }) => ({
          id,
          firstName,
          lastName,
        }))}
      />
    </div>
  );
}
