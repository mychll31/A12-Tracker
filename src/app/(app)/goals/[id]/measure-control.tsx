"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import type { GoalDirection } from "@/lib/domain";

import { setMeasureAction } from "../actions";
import { initialGoalState, type GoalFormState } from "../../_lib/form-state";

/**
 * The goal's numeric measure — the only thing that moves its score. Shows how
 * far `current` has come toward `target`, and lets the owner update `current`.
 */
export function MeasureControl({
  goalId,
  direction,
  targetValue,
  currentValue,
  unit,
  progress,
}: {
  goalId: string;
  direction: GoalDirection;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(
    async (_prev: GoalFormState, formData: FormData): Promise<GoalFormState> => {
      const result = await setMeasureAction(formData);
      if (!result.error) {
        toast({ title: "Progress saved", variant: "success" });
      }
      return result;
    },
    initialGoalState,
  );

  const verb = direction === "LOSE" ? "to lose" : "to gain";

  return (
    <div className="w-full min-w-0 flex-1">
      {targetValue > 0 ? (
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted">
            <span className="font-semibold tabular-nums text-foreground">
              {currentValue}
            </span>{" "}
            of{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {targetValue}
            </span>
            {unit ? ` ${unit}` : ""} {verb}
          </p>
          <span className="text-sm font-semibold tabular-nums">{progress}%</span>
        </div>
      ) : (
        <p className="text-sm text-muted">
          No measure set yet — add a target to start scoring this goal.
        </p>
      )}

      <ProgressBar value={progress} showValue={false} className="mt-2" />

      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="goalId" value={goalId} />
        <label
          htmlFor={`current-${goalId}`}
          className="text-xs font-medium text-muted-strong"
        >
          Current
        </label>
        <Input
          id={`current-${goalId}`}
          name="currentValue"
          type="number"
          min={0}
          step="any"
          defaultValue={currentValue}
          aria-label="Current value"
          className="max-w-32"
        />
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
        <Button type="submit" variant="secondary" size="sm" isLoading={pending}>
          Save
        </Button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-500 dark:text-rose-400">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
