"use client";

import { useActionState, useTransition } from "react";
import {
  AlertCircle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Plus,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ACTION_PLAN_STATUS_LABELS,
  type ActionPlanStatus,
} from "@/lib/domain";

import {
  addActionPlanAction,
  deleteActionPlanAction,
  setActionPlanStatusAction,
} from "../actions";
import { initialGoalState } from "../../_lib/form-state";

export type PlanItem = {
  id: string;
  title: string;
  status: ActionPlanStatus;
};

const NEXT: Record<ActionPlanStatus, ActionPlanStatus> = {
  NOT_STARTED: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "NOT_STARTED",
};

const STATUS_STYLE: Record<
  ActionPlanStatus,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  NOT_STARTED: { icon: CircleDashed, className: "text-muted" },
  IN_PROGRESS: { icon: CircleDot, className: "text-amber-500" },
  DONE: { icon: CircleCheck, className: "text-emerald-500" },
};

export function TaskList({
  goalId,
  plans,
}: {
  goalId: string;
  plans: PlanItem[];
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(
    addActionPlanAction,
    initialGoalState,
  );

  function cycleStatus(plan: PlanItem) {
    startTransition(async () => {
      const body = new FormData();
      body.set("goalId", goalId);
      body.set("goalTaskId", plan.id);
      body.set("status", NEXT[plan.status]);
      const result = await setActionPlanStatusAction(body);
      if (result.error) {
        toast({
          title: "Could not update that plan",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  function remove(plan: PlanItem) {
    startTransition(async () => {
      const body = new FormData();
      body.set("goalId", goalId);
      body.set("goalTaskId", plan.id);
      const result = await deleteActionPlanAction(body);
      if (result.error) {
        toast({
          title: "Could not remove that plan",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {plans.length ? (
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => {
            const style = STATUS_STYLE[plan.status];
            const Icon = style.icon;
            return (
              <li
                key={plan.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => cycleStatus(plan)}
                  title="Click to change status"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    style.className,
                  )}
                >
                  <Icon className="size-3.5" />
                  {ACTION_PLAN_STATUS_LABELS[plan.status]}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm",
                    plan.status === "DONE"
                      ? "text-muted line-through"
                      : "text-foreground",
                  )}
                >
                  {plan.title}
                </span>
                <button
                  type="button"
                  onClick={() => remove(plan)}
                  aria-label={`Remove ${plan.title}`}
                  className="shrink-0 rounded p-1 text-muted transition-colors hover:text-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No action plans yet. Add the steps you&apos;ll take to hit this goal —
          they&apos;re shown here, but the score comes from the measure above.
        </p>
      )}

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="goalId" value={goalId} />
        <Input
          name="title"
          placeholder="Add an action plan…"
          aria-label="New action plan"
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
