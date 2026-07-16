"use client";

import { useState, useTransition } from "react";
import { Check, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { MeritTargetItem } from "@/server/goals";

import { goExtraMileAction, logMeritTargetAction } from "../dashboard/actions";

/**
 * The goal-derived targets on the Core Tasks board. Checking one logs this
 * period's amount toward its merit goal; "extra mile" logs more, so the goal is
 * hit sooner. The board re-fetches after each write, so `done` stays truthful.
 */
export function MeritTargets({ items }: { items: MeritTargetItem[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [extra, setExtra] = useState("");

  function label(amount: number, unit: string) {
    return `${amount}${unit ? ` ${unit}` : ""}`;
  }

  function check(item: MeritTargetItem) {
    if (item.done) return;
    startTransition(async () => {
      const body = new FormData();
      body.set("goalId", item.goalId);
      const result = await logMeritTargetAction(body);
      if (result.error) {
        toast({
          title: "Couldn't log that",
          description: result.error,
          variant: "danger",
        });
      } else {
        toast({
          title: `Logged ${label(item.periodTarget, item.unit)}`,
          variant: "success",
        });
      }
    });
  }

  function logExtra(item: MeritTargetItem) {
    const amount = Number(extra);
    if (!Number.isFinite(amount) || amount <= 0) return;
    startTransition(async () => {
      const body = new FormData();
      body.set("goalId", item.goalId);
      body.set("amount", String(amount));
      const result = await goExtraMileAction(body);
      if (result.error) {
        toast({
          title: "Couldn't log that",
          description: result.error,
          variant: "danger",
        });
      } else {
        toast({
          title: `Extra ${label(amount, item.unit)} logged`,
          variant: "success",
        });
        setExtraFor(null);
        setExtra("");
      }
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const verb = item.direction === "LOSE" ? "lose" : "gain";
        const pct =
          item.targetValue > 0
            ? Math.min(100, (item.currentValue / item.targetValue) * 100)
            : 0;
        const open = extraFor === item.goalId;

        return (
          <li
            key={item.goalId}
            className="rounded-xl border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => check(item)}
                disabled={item.done || pending}
                aria-label={
                  item.done ? "Logged this period" : "Log this period's target"
                }
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  item.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border-strong hover:border-primary",
                )}
              >
                {item.done ? <Check className="size-4" /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted">
                  {item.done ? "Done this period · " : ""}
                  <span className="font-medium text-foreground">
                    {label(item.periodTarget, item.unit)}
                  </span>{" "}
                  to {verb} ·{" "}
                  <span className="tabular-nums">
                    {item.currentValue}/{item.targetValue}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                icon={<TrendingUp />}
                onClick={() => setExtraFor(open ? null : item.goalId)}
              >
                Extra mile
              </Button>
            </div>

            <ProgressBar value={pct} showValue={false} className="mt-2.5" />

            {open ? (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={extra}
                  onChange={(event) => setExtra(event.target.value)}
                  placeholder={`Extra ${item.unit || "amount"}`}
                  aria-label="Extra amount"
                  className="max-w-40"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={pending}
                  onClick={() => logExtra(item)}
                >
                  Log extra
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
