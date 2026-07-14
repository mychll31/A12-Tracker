"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { toggleTask } from "./actions";
import { TaskIcon } from "./lucide-icon";

export type TodayTaskItem = {
  taskId: string;
  name: string;
  icon: string;
  completed: boolean;
  notes?: string | null;
};

export interface TodayTasksProps {
  userId: string;
  /** `YYYY-MM-DD` — the UTC day bucket every completion row is keyed on. */
  date: string;
  items: TodayTaskItem[];
  /** Core Tasks page only: optional proof/notes against a ticked task. */
  showNotes?: boolean;
}

export function TodayTasks({
  userId,
  date,
  items,
  showNotes = false,
}: TodayTasksProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.taskId, i.notes ?? ""])),
  );

  const [optimistic, applyOptimistic] = useOptimistic(
    items,
    (state, taskId: string) =>
      state.map((item) =>
        item.taskId === taskId
          ? { ...item, completed: !item.completed }
          : item,
      ),
  );

  function post(fields: Record<string, string>) {
    const body = new FormData();
    body.set("userId", userId);
    body.set("date", date);
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return toggleTask(body);
  }

  function onToggle(item: TodayTaskItem) {
    startTransition(async () => {
      // A rejected write never revalidates, so the optimistic tick is dropped
      // when the transition settles — the checkbox falls back on its own.
      applyOptimistic(item.taskId);

      const result = await post({
        coreTaskId: item.taskId,
        completed: String(!item.completed),
      });

      if (result.error) {
        toast({
          title: "Could not save that task",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  function onSaveNote(item: TodayTaskItem) {
    setSavingNote(item.taskId);
    startTransition(async () => {
      const result = await post({
        coreTaskId: item.taskId,
        completed: "true",
        notes: drafts[item.taskId] ?? "",
      });
      setSavingNote(null);

      toast(
        result.error
          ? {
              title: "Could not save that note",
              description: result.error,
              variant: "danger",
            }
          : { title: "Note saved", variant: "success" },
      );
    });
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {optimistic.map((item) => (
        <li key={item.taskId}>
          <label
            className={cn(
              "flex min-h-[3.75rem] cursor-pointer select-none items-center gap-4 rounded-xl px-4 py-3",
              "border transition-colors duration-150",
              item.completed
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => onToggle(item)}
              className="peer sr-only"
            />

            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                item.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border-strong bg-surface-raised",
              )}
            >
              {item.completed ? <Check className="size-4" /> : null}
            </span>

            <TaskIcon
              name={item.icon}
              className={cn(
                "size-5 shrink-0",
                item.completed ? "text-emerald-500" : "text-muted",
              )}
            />

            <span
              className={cn(
                "flex-1 text-sm font-medium",
                item.completed ? "text-muted line-through" : "text-foreground",
              )}
            >
              {item.name}
            </span>
          </label>

          {showNotes && item.completed ? (
            <details className="mt-1.5 pl-4">
              <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground">
                <StickyNote className="size-3.5" aria-hidden="true" />
                {item.notes ? "Edit note" : "Add a note"}
              </summary>

              <div className="mt-2 flex flex-col gap-2">
                <Textarea
                  rows={2}
                  value={drafts[item.taskId] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.taskId]: event.target.value,
                    }))
                  }
                  placeholder="Proof, reflection, or how it went…"
                  aria-label={`Note for ${item.name}`}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  isLoading={savingNote === item.taskId}
                  onClick={() => onSaveNote(item)}
                >
                  Save note
                </Button>
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
