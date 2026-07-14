"use client";

import { useActionState, useEffect, useRef } from "react";
import { BellRing, RefreshCw } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from "@/components/ui";
import { notificationSweepAction, recalculateAction } from "./actions";
import { IDLE_ACTION_STATE } from "../_lib/form-state";
import type { AdminActionState as ActionState } from "../_lib/form-state";

/**
 * The nightly cron, runnable on demand.
 *
 * Both jobs are idempotent — snapshots, captures and the sweep all overwrite or
 * dedupe within the day — so an admin pressing a button twice is harmless.
 */

type Job = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  title: string;
  description: string;
  icon: typeof RefreshCw;
};

const JOBS: Job[] = [
  {
    action: recalculateAction,
    label: "Recalculate scores",
    title: "Recalculate scores",
    description:
      "Re-derives every member, coach, group and organization score, freezes today's snapshot and captures every leaderboard.",
    icon: RefreshCw,
  },
  {
    action: notificationSweepAction,
    label: "Run sweep",
    title: "Notification sweep",
    description:
      "Creates the reminders the organization is due today — missed tasks, goal deadlines, check-ins, leaderboard moves and achievements.",
    icon: BellRing,
  },
];

function JobRow({ job }: { job: Job }) {
  const [state, formAction, pending] = useActionState(
    job.action,
    IDLE_ACTION_STATE,
  );
  const { toast } = useToast();
  const handled = useRef<ActionState | null>(null);
  const Icon = job.icon;

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;

    if (state.ok && state.message) {
      toast({
        title: job.title,
        description: state.message,
        variant: "success",
      });
    } else if (state.error) {
      toast({ title: job.title, description: state.error, variant: "danger" });
    }
  }, [state, toast, job.title]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-sunken p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft"
          aria-hidden="true"
        >
          <Icon className="size-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{job.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {job.description}
          </p>
        </div>
      </div>

      <Button
        type="submit"
        variant="outline"
        size="sm"
        isLoading={pending}
        className="shrink-0 sm:ml-4"
      >
        {job.label}
      </Button>
    </form>
  );
}

export function MaintenancePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System maintenance</CardTitle>
        <CardDescription>
          These are the jobs the nightly cron runs. Both are safe to re-run —
          they overwrite today&apos;s numbers rather than stacking a second set
          behind them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {JOBS.map((job) => (
          <JobRow key={job.title} job={job} />
        ))}
      </CardContent>
    </Card>
  );
}
