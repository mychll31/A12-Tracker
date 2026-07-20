"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ListTodo, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import { FormField, Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GOAL_CATEGORY_KEYS,
  GOAL_DIRECTIONS,
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  TARGET_PERIODS,
  TARGET_PERIOD_LABELS,
  type GoalCategoryKey,
  type GoalType,
} from "@/lib/domain";

import { createGoalAction } from "./actions";
import { initialGoalState } from "../_lib/form-state";
import { GOAL_CATEGORY_LABELS } from "./categories";
import { DEFAULT_GOAL_TARGET_DATE } from "./defaults";

const CATEGORY_OPTIONS = GOAL_CATEGORY_KEYS.map((key) => ({
  value: key,
  label: GOAL_CATEGORY_LABELS[key],
}));

const DIRECTION_OPTIONS = GOAL_DIRECTIONS.map((key) => ({
  value: key,
  label: key === "LOSE" ? "Lose" : "Gain",
}));

const PERIOD_OPTIONS = TARGET_PERIODS.map((key) => ({
  value: key,
  label: TARGET_PERIOD_LABELS[key],
}));

const TYPE_BLURB: Record<GoalType, string> = {
  MERIT: "A number you chip away at over time.",
  MILESTONE: "Done when its action plans are done.",
};

export interface NewGoalDialogProps {
  /** Pre-selects the category, so a category card can open the dialog on its own gap. */
  defaultCategory?: GoalCategoryKey;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
}

export function NewGoalDialog({
  defaultCategory,
  triggerLabel = "New goal",
  triggerVariant = "primary",
  triggerSize = "md",
}: NewGoalDialogProps) {
  const [open, setOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("MERIT");
  const [tasks, setTasks] = useState<string[]>([""]);
  const [state, formAction, pending] = useActionState(
    createGoalAction,
    initialGoalState,
  );

  function updateTask(index: number, value: string) {
    setTasks((current) =>
      current.map((item, i) => (i === index ? value : item)),
    );
  }

  const isMerit = goalType === "MERIT";
  const filled = tasks.filter((task) => task.trim().length > 0).length;

  return (
    <>
      <Button
        icon={<Plus />}
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set a new goal"
        description="Personal, professional or contribution — all three categories count towards your Goal Total Score."
        size="lg"
      >
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="goalType" value={goalType} />

          <div className="flex flex-col gap-2">
            <Label>Goal type</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {GOAL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGoalType(type)}
                  aria-pressed={goalType === type}
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    goalType === type
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {GOAL_TYPE_LABELS[type]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {TYPE_BLURB[type]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <FormField label="Title" required>
            <Input
              name="title"
              placeholder="Run a half marathon under two hours"
              required
              minLength={3}
            />
          </FormField>

          <FormField
            label="Description"
            hint="What does done actually look like?"
          >
            <Textarea
              name="description"
              rows={3}
              placeholder="The outcome you are committing to…"
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Category" required>
              <Select
                name="categoryKey"
                options={CATEGORY_OPTIONS}
                defaultValue={defaultCategory}
                placeholder={defaultCategory ? undefined : "Choose a category"}
                required
              />
            </FormField>

            <FormField label="Target date" required>
              <Input
                name="targetDate"
                type="date"
                defaultValue={DEFAULT_GOAL_TARGET_DATE}
                required
              />
            </FormField>
          </div>

          {isMerit ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Direction" required>
                  <Select
                    name="direction"
                    options={DIRECTION_OPTIONS}
                    defaultValue="GAIN"
                  />
                </FormField>
                <FormField label="Unit" hint="e.g. Kg, M, books">
                  <Input name="unit" maxLength={20} placeholder="Kg" />
                </FormField>
                <FormField
                  label="Target value"
                  required
                  hint="The number you're aiming for."
                >
                  <Input
                    name="targetValue"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="10"
                    required
                  />
                </FormField>
                <FormField label="Current value" hint="Where you are now.">
                  <Input
                    name="currentValue"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                  />
                </FormField>
              </div>

              <FormField
                label="Target period"
                hint="Splits the target into a recurring task on your Core Tasks."
              >
                <Select
                  name="targetPeriod"
                  options={PERIOD_OPTIONS}
                  defaultValue="DAILY"
                />
              </FormField>
            </>
          ) : (
            <input type="hidden" name="targetPeriod" value="NONE" />
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken p-4">
            <div className="flex items-center gap-2">
              <ListTodo className="size-4 text-muted" aria-hidden="true" />
              <Label>Action plans</Label>
              <span className="ml-auto text-xs tabular-nums text-muted">
                {filled} {filled === 1 ? "plan" : "plans"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {isMerit
                ? "Optional — the steps you'll take. The score comes from the measure above; these just track the work."
                : "This is the goal — its score is how far these plans are done (in progress counts half)."}
            </p>

            <ul className="mt-1 flex flex-col gap-2">
              {tasks.map((task, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded border-2 border-border-strong"
                  />
                  <Input
                    name="task"
                    value={task}
                    onChange={(event) => updateTask(index, event.target.value)}
                    placeholder={`Plan ${index + 1}`}
                    aria-label={`Plan ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove plan ${index + 1}`}
                    disabled={tasks.length === 1}
                    onClick={() =>
                      setTasks((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              size="sm"
              icon={<Plus />}
              className="self-start"
              onClick={() => setTasks((current) => [...current, ""])}
            >
              Add plan
            </Button>
          </div>

          <FormField label="Notes">
            <Textarea
              name="notes"
              rows={2}
              placeholder="Anything you want your coach to know."
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

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
            {!isMerit && filled === 0 ? (
              <p className="mr-auto text-xs text-muted">
                Add at least one action plan to create a milestone goal.
              </p>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={pending}
              disabled={!isMerit && filled === 0}
            >
              Create goal
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
