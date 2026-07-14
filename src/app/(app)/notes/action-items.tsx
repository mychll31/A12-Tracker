"use client";

import { useOptimistic, useTransition } from "react";

import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

import { toggleActionItemAction } from "./actions";

/**
 * Dates arrive already formatted. A client island never re-formats a date: the
 * browser sits in its own time zone, and the UTC day bucket the server chose is
 * the one the reader must see.
 */
export type ActionItemView = {
  id: string;
  title: string;
  isDone: boolean;
  dueLabel: string | null;
};

export function ActionItems({ items }: { items: ActionItemView[] }) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [optimistic, tick] = useOptimistic(items, (state, id: string) =>
    state.map((item) =>
      item.id === id ? { ...item, isDone: !item.isDone } : item,
    ),
  );

  function onToggle(id: string) {
    startTransition(async () => {
      tick(id);
      const result = await toggleActionItemAction(id);
      if (result.error) {
        toast({
          title: "Couldn't update that item",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  if (optimistic.length === 0) return null;

  return (
    <ul className="mt-4 space-y-1 border-t border-border pt-4">
      {optimistic.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-sunken">
            <input
              type="checkbox"
              checked={item.isDone}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border-strong text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "text-sm",
                  item.isDone && "text-muted line-through",
                )}
              >
                {item.title}
              </span>
              {item.dueLabel ? (
                <span className="ml-2 text-xs text-muted">
                  due {item.dueLabel}
                </span>
              ) : null}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
