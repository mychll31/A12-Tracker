"use client";

import { useTransition } from "react";
import { CircleCheck, CircleDashed, CircleDot } from "lucide-react";
import type { ComponentType } from "react";

import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ACTION_PLAN_STATUS_LABELS,
  type ActionPlanStatus,
} from "@/lib/domain";
import type { MilestoneTargetItem } from "@/server/goals";

import { setMilestonePlanAction } from "../dashboard/actions";

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

/**
 * Milestone goals on the Core Tasks board. Each is a checklist of its action
 * plans; moving a plan's status is what moves the goal's score. The board
 * re-fetches after each change, so the progress bar stays truthful.
 */
export function MilestoneTargets({ items }: { items: MilestoneTargetItem[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function cycle(planId: string, status: ActionPlanStatus) {
    startTransition(async () => {
      const body = new FormData();
      body.set("goalTaskId", planId);
      body.set("status", NEXT[status]);
      const result = await setMilestonePlanAction(body);
      if (result.error) {
        toast({
          title: "Couldn't update that plan",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((goal) => (
        <li
          key={goal.goalId}
          className="rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {goal.title}
            </p>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
              {goal.score}%
            </span>
          </div>

          <ProgressBar value={goal.score} showValue={false} className="mt-2" />

          <ul className="mt-3 flex flex-col gap-1.5">
            {goal.plans.map((plan) => {
              const style = STATUS_STYLE[plan.status];
              const Icon = style.icon;
              return (
                <li key={plan.id} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => cycle(plan.id, plan.status)}
                    disabled={pending}
                    title="Click to change status"
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[0.6875rem] font-medium transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
