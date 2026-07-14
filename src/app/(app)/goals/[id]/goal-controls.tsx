"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  type GoalStatus,
} from "@/lib/domain";

import { deleteGoalAction, setGoalStatusAction, updateGoalAction } from "../actions";
import { initialGoalState } from "../../_lib/form-state";
import type { GoalFormState } from "../../_lib/form-state";

const STATUS_OPTIONS = GOAL_STATUSES.map((key) => ({
  value: key,
  label: GOAL_STATUS_LABELS[key],
}));

export type GoalControlsGoal = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: GoalStatus;
  /** `YYYY-MM-DD` — what `<input type="date">` reads and writes. */
  targetDate: string;
};

/** Closes a modal the moment its action lands without an error. */
function useCloseOnSuccess(
  state: GoalFormState,
  pending: boolean,
  close: () => void,
) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) close();
    wasPending.current = pending;
  }, [pending, state.error, close]);
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export function GoalControls({ goal }: { goal: GoalControlsGoal }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const statusForm = useRef<HTMLFormElement>(null);
  const [statusState, statusAction, statusPending] = useActionState(
    setGoalStatusAction,
    initialGoalState,
  );
  const [editState, editAction, editPending] = useActionState(
    updateGoalAction,
    initialGoalState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteGoalAction,
    initialGoalState,
  );

  useCloseOnSuccess(editState, editPending, () => setEditing(false));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form ref={statusForm} action={statusAction} className="w-44">
        <input type="hidden" name="goalId" value={goal.id} />
        <Select
          name="status"
          aria-label="Goal status"
          options={STATUS_OPTIONS}
          defaultValue={goal.status}
          disabled={statusPending}
          onChange={() => statusForm.current?.requestSubmit()}
        />
      </form>

      <Button
        variant="outline"
        icon={<Pencil />}
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>

      <Button
        variant="ghost"
        icon={<Trash2 />}
        className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
        onClick={() => setConfirmingDelete(true)}
      >
        Delete
      </Button>

      {statusState.error ? (
        <p
          role="alert"
          className="w-full text-xs text-rose-500 dark:text-rose-400"
        >
          {statusState.error}
        </p>
      ) : null}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit goal"
        description="Progress itself is derived from tasks — it cannot be typed in here."
        size="lg"
      >
        <form action={editAction} className="flex flex-col gap-5">
          <input type="hidden" name="goalId" value={goal.id} />

          <FormField label="Title" required>
            <Input
              name="title"
              defaultValue={goal.title}
              required
              minLength={3}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              name="description"
              rows={3}
              defaultValue={goal.description ?? ""}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Status" required>
              <Select
                name="status"
                options={STATUS_OPTIONS}
                defaultValue={goal.status}
              />
            </FormField>

            <FormField label="Target date" required>
              <Input
                name="targetDate"
                type="date"
                defaultValue={goal.targetDate}
                required
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <Textarea name="notes" rows={3} defaultValue={goal.notes ?? ""} />
          </FormField>

          {editState.error ? <ErrorNote message={editState.error} /> : null}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={editPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={editPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this goal?"
        description="Its tasks, comments, progress history and attachments go with it. This cannot be undone."
        size="sm"
      >
        <form action={deleteAction} className="flex flex-col gap-4">
          <input type="hidden" name="goalId" value={goal.id} />

          {deleteState.error ? <ErrorNote message={deleteState.error} /> : null}

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={deletePending}
            >
              Keep it
            </Button>
            <Button type="submit" variant="danger" isLoading={deletePending}>
              Delete goal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
