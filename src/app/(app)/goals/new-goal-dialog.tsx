"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ListTodo, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import { FormField, Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { GOAL_CATEGORY_KEYS, type GoalCategoryKey } from "@/lib/domain";

import { createGoalAction } from "./actions";
import { initialGoalState } from "../_lib/form-state";
import { GOAL_CATEGORY_LABELS } from "./categories";

const CATEGORY_OPTIONS = GOAL_CATEGORY_KEYS.map((key) => ({
  value: key,
  label: GOAL_CATEGORY_LABELS[key],
}));

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

  // A goal's score IS the share of its tasks that are done, so a goal with no
  // tasks could never score above zero. The server refuses one; the form refuses
  // to let you get that far.
  const filled = tasks.filter((task) => task.trim().length > 0).length;
  const canSubmit = filled > 0;

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
              <Input name="targetDate" type="date" required />
            </FormField>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken p-4">
            <div className="flex items-center gap-2">
              <ListTodo className="size-4 text-muted" aria-hidden="true" />
              <Label required>Tasks</Label>
              <span className="ml-auto text-xs tabular-nums text-muted">
                {filled} {filled === 1 ? "task" : "tasks"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              A goal is scored by the work inside it — add at least one task.
              Ticking these off is what moves this goal&apos;s score.
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
                    placeholder={`Task ${index + 1}`}
                    aria-label={`Task ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove task ${index + 1}`}
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
              Add task
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
            {!canSubmit ? (
              <p className="mr-auto text-xs text-muted">
                Add a task to continue — a goal is scored by the work inside it.
              </p>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={pending} disabled={!canSubmit}>
              Create goal
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
