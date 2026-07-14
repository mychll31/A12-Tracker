"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/input";
import { MOOD_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";

import { submitCheckIn } from "./actions";
import { initialCheckInState } from "../_lib/form-state";

const MOODS = [1, 2, 3, 4, 5] as const;

export type CheckInDraft = {
  wins: string | null;
  challenges: string | null;
  lessons: string | null;
  gratitude: string | null;
  tomorrowFocus: string | null;
  mood: number;
};

export function CheckInForm({ initial }: { initial: CheckInDraft | null }) {
  const [state, formAction, pending] = useActionState(
    submitCheckIn,
    initialCheckInState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium leading-none text-muted-strong">
          How did today feel?
        </legend>

        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((mood) => (
            <label
              key={mood}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-2 py-3",
                "border border-border bg-surface text-center transition-colors",
                "hover:border-border-strong",
                "has-[:checked]:border-primary has-[:checked]:bg-primary-soft",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              )}
            >
              <input
                type="radio"
                name="mood"
                value={mood}
                required
                defaultChecked={(initial?.mood ?? 0) === mood}
                className="sr-only"
              />
              <span className="text-base font-semibold tabular-nums">
                {mood}
              </span>
              <span className="text-[0.6875rem] leading-tight text-muted">
                {MOOD_LABELS[mood]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField label="Wins today" hint="What went right, however small.">
        <Textarea
          name="wins"
          rows={3}
          defaultValue={initial?.wins ?? ""}
          placeholder="Shipped the proposal. Ran 5k before work."
        />
      </FormField>

      <FormField label="Challenges">
        <Textarea
          name="challenges"
          rows={3}
          defaultValue={initial?.challenges ?? ""}
          placeholder="What got in the way?"
        />
      </FormField>

      <FormField label="Lessons learned">
        <Textarea
          name="lessons"
          rows={3}
          defaultValue={initial?.lessons ?? ""}
          placeholder="What would you do differently tomorrow?"
        />
      </FormField>

      <FormField label="Gratitude">
        <Textarea
          name="gratitude"
          rows={3}
          defaultValue={initial?.gratitude ?? ""}
          placeholder="Who or what are you grateful for today?"
        />
      </FormField>

      <FormField label="Tomorrow's focus">
        <Textarea
          name="tomorrowFocus"
          rows={3}
          defaultValue={initial?.tomorrowFocus ?? ""}
          placeholder="The one thing that would make tomorrow a win."
        />
      </FormField>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      {state.saved ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Check-in saved for today.
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        isLoading={pending}
        className="sm:self-start"
      >
        {initial ? "Update today's check-in" : "File today's check-in"}
      </Button>
    </form>
  );
}
