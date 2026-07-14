import type { Metadata } from "next";
import { CalendarCheck, NotebookPen, Smile } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat";
import { MoodChart } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/dates";
import { MOOD_LABELS } from "@/lib/domain";
import { checkInStreak, getCheckIn, listCheckIns } from "@/server/check-ins";

import { CheckInForm } from "./check-in-form";

export const metadata: Metadata = { title: "Daily Check-In" };

const WINDOW_DAYS = 30;
const HISTORY_LIMIT = 30;

const SECTIONS = [
  { key: "wins", label: "Wins" },
  { key: "challenges", label: "Challenges" },
  { key: "lessons", label: "Lessons" },
  { key: "gratitude", label: "Gratitude" },
  { key: "tomorrowFocus", label: "Tomorrow's focus" },
] as const;

export default async function CheckInPage() {
  const user = await requireUser();

  const [todaysCheckIn, past, moods] = await Promise.all([
    getCheckIn(user, user.id),
    listCheckIns(user, user.id, HISTORY_LIMIT),
    checkInStreak(user, user.id, WINDOW_DAYS),
  ]);

  const filed = moods.filter((day) => day.hasCheckIn).length;
  const scored = moods.filter((day) => day.mood !== null);
  const averageMood = scored.length
    ? (
        scored.reduce((sum, day) => sum + (day.mood ?? 0), 0) / scored.length
      ).toFixed(1)
    : "—";

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Daily check-in
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {formatDate(new Date())} — five questions, two minutes, and the
          consistency half of your score.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Check-ins (30d)"
          value={`${filed}/${moods.length}`}
          icon={CalendarCheck}
        />
        <StatCard label="Average mood" value={averageMood} icon={Smile} />
        <StatCard
          label="Today"
          value={todaysCheckIn ? "Filed" : "Not yet"}
          icon={NotebookPen}
          tone={todaysCheckIn ? "excellent" : "warning"}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2">
            {todaysCheckIn ? "Edit today's check-in" : "Today's check-in"}
          </CardTitle>
          <CardDescription>
            {todaysCheckIn
              ? "You have already checked in today. Saving again overwrites this entry."
              : "Honest beats impressive. Nobody scores you on the prose."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckInForm
            initial={
              todaysCheckIn
                ? {
                    wins: todaysCheckIn.wins,
                    challenges: todaysCheckIn.challenges,
                    lessons: todaysCheckIn.lessons,
                    gratitude: todaysCheckIn.gratitude,
                    tomorrowFocus: todaysCheckIn.tomorrowFocus,
                    mood: todaysCheckIn.mood,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Mood</CardTitle>
          <CardDescription>
            The last 30 days. Gaps are days you did not check in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MoodChart data={moods} height={220} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Past check-ins</h2>

        {past.length ? (
          <ul className="flex flex-col gap-4">
            {past.map((checkIn) => (
              <li key={checkIn.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold">
                        {formatDate(checkIn.date)}
                      </p>
                      <p className="text-xs text-muted">
                        {formatRelative(checkIn.date)}
                      </p>
                    </div>
                    <Badge variant="primary" size="sm">
                      {checkIn.mood} · {MOOD_LABELS[checkIn.mood]}
                    </Badge>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {SECTIONS.map(({ key, label }) =>
                      checkIn[key] ? (
                        <div key={key}>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                            {label}
                          </dt>
                          <dd className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">
                            {checkIn[key]}
                          </dd>
                        </div>
                      ) : null,
                    )}
                  </dl>

                  {checkIn.reviews.length ? (
                    <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                      {checkIn.reviews.map((review) => (
                        <li key={review.id} className="flex gap-3">
                          <Avatar
                            size="sm"
                            src={review.coach.avatarUrl}
                            firstName={review.coach.firstName}
                            lastName={review.coach.lastName}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                              <span className="font-medium text-foreground">
                                {review.coach.firstName} {review.coach.lastName}
                              </span>
                              <span>{formatRelative(review.createdAt)}</span>
                            </p>
                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                              {review.comment}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={NotebookPen}
            title="No check-ins yet"
            description="File today's and it starts a streak. Your coach can read and reply to every one."
          />
        )}
      </section>
    </div>
  );
}
