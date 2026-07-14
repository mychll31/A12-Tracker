"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MS_PER_DAY = 86_400_000;

function shift(isoDay: string, days: number): string {
  const next = new Date(`${isoDay}T00:00:00.000Z`).getTime() + days * MS_PER_DAY;
  return new Date(next).toISOString().slice(0, 10);
}

export function DateNav({
  date,
  today,
}: {
  /** `YYYY-MM-DD` — the day the board is showing. */
  date: string;
  /** `YYYY-MM-DD` — the board never runs ahead of today. */
  today: string;
}) {
  const router = useRouter();

  function go(next: string) {
    router.push(next >= today ? "/core-tasks" : `/core-tasks?date=${next}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-label="Previous day"
        onClick={() => go(shift(date, -1))}
      >
        <ChevronLeft />
      </Button>

      <Input
        type="date"
        value={date}
        max={today}
        aria-label="Board date"
        className="h-8 w-40 text-xs"
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
      />

      <Button
        variant="outline"
        size="sm"
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => go(shift(date, 1))}
      >
        <ChevronRight />
      </Button>

      {date !== today ? (
        <Button variant="ghost" size="sm" onClick={() => go(today)}>
          Today
        </Button>
      ) : null}
    </div>
  );
}
