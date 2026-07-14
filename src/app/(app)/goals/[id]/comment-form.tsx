"use client";

import { useActionState } from "react";
import { AlertCircle, Lock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

import { addCommentAction } from "../actions";
import { initialGoalState } from "../../_lib/form-state";

export function CommentForm({
  goalId,
  canPostPrivate,
}: {
  goalId: string;
  /** Only a coach or admin may hide a comment from the mentee it is about. */
  canPostPrivate: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    addCommentAction,
    initialGoalState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="goalId" value={goalId} />

      <Textarea
        name="body"
        rows={3}
        required
        placeholder="Ask a question, log a reflection, or reply to your coach…"
        aria-label="Add a comment"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canPostPrivate ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-strong">
            <input
              type="checkbox"
              name="isPrivate"
              value="true"
              className="size-4 accent-[var(--primary)]"
            />
            <Lock className="size-3.5" aria-hidden="true" />
            Coach only
          </label>
        ) : (
          <span />
        )}

        <Button
          type="submit"
          size="sm"
          icon={<Send />}
          isLoading={pending}
          className="ml-auto"
        >
          Post comment
        </Button>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs text-rose-500 dark:text-rose-400"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
