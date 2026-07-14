"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { AlertCircle, Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { addGoalTaskAction, toggleGoalTaskAction } from "../actions";
import { initialGoalState } from "../../_lib/form-state";

export type TaskItem = {
  id: string;
  title: string;
  isComplete: boolean;
  dueDate: Date | null;
};

export function TaskList({
  goalId,
  tasks,
}: {
  goalId: string;
  tasks: TaskItem[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(
    addGoalTaskAction,
    initialGoalState,
  );

  const [optimistic, applyOptimistic] = useOptimistic(
    tasks,
    (current, goalTaskId: string) =>
      current.map((item) =>
        item.id === goalTaskId
          ? { ...item, isComplete: !item.isComplete }
          : item,
      ),
  );

  function onToggle(task: TaskItem) {
    startTransition(async () => {
      // A refused write never revalidates, so the tick unwinds when the
      // transition settles.
      applyOptimistic(task.id);

      const body = new FormData();
      body.set("goalId", goalId);
      body.set("goalTaskId", task.id);

      const result = await toggleGoalTaskAction(body);
      if (result.error) {
        toast({
          title: "Could not update that task",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  const done = optimistic.filter((m) => m.isComplete).length;

  return (
    <div className="flex flex-col gap-4">
      {optimistic.length ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold tabular-nums">
              {done}/{optimistic.length} complete
            </p>
            {/* The tick is the only thing that moves the score: toggleGoalTask
                re-derives it server-side from this list. */}
            <p className="text-xs text-muted">
              Ticking a task is what moves this goal&apos;s score.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {optimistic.map((task) => (
              <li key={task.id}>
                <label
                  className={cn(
                    "flex min-h-[3.25rem] cursor-pointer select-none items-center gap-3 rounded-xl px-3.5 py-2.5",
                    "border transition-colors duration-150",
                    task.isComplete
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={task.isComplete}
                    onChange={() => onToggle(task)}
                    className="peer sr-only"
                  />

                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded border-2 transition-colors",
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                      task.isComplete
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border-strong bg-surface-raised",
                    )}
                  >
                    {task.isComplete ? (
                      <Check className="size-3.5" />
                    ) : null}
                  </span>

                  <span
                    className={cn(
                      "flex-1 text-sm",
                      task.isComplete
                        ? "text-muted line-through"
                        : "text-foreground",
                    )}
                  >
                    {task.title}
                  </span>

                  {task.dueDate ? (
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(task.dueDate)}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">
          No tasks yet. A goal is scored by the work inside it — add one and this
          goal&apos;s score starts tracking your to-do list.
        </p>
      )}

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="goalId" value={goalId} />
        <Input
          name="title"
          placeholder="Add a task…"
          aria-label="New task"
          required
        />
        <Button
          type="submit"
          variant="secondary"
          icon={<Plus />}
          isLoading={pending}
        >
          Add
        </Button>
      </form>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs text-rose-500 dark:text-rose-400"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
