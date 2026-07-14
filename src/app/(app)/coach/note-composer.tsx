"use client";

import { useActionState, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import type { NoteVisibility } from "@/lib/domain";

import { createNoteAction, updateNoteAction } from "./actions";
import { INITIAL_ACTION_STATE } from "../_lib/form-state";
import type { ActionState } from "../_lib/form-state";

/**
 * The note composer, shared by the notes page and the mentee drilldown.
 *
 * Action items only exist on create: `updateNote` deliberately does not touch
 * them, so an existing note's items are managed on the note itself rather than
 * silently rewritten from a form the coach may not have looked at.
 */

export type ComposerMentee = {
  id: string;
  firstName: string;
  lastName: string;
};

export type ComposerNote = {
  id: string;
  menteeId: string;
  title: string;
  body: string;
  visibility: NoteVisibility;
  followUpDate: Date | null;
};

export interface NoteComposerProps {
  open: boolean;
  onClose: () => void;
  /** Every mentee the coach may write about. Ignored when `fixedMenteeId` is set. */
  mentees: ComposerMentee[];
  /** Opened from a drilldown: the subject is decided and not re-picked. */
  fixedMenteeId?: string;
  /** Present for edit, absent for create. */
  note?: ComposerNote;
}

type DraftItem = { key: string; title: string; dueDate: string };

const VISIBILITY_OPTIONS = [
  { value: "PRIVATE", label: "Private — only you (and admins)" },
  { value: "SHARED", label: "Shared — the mentee and fellow coaches" },
];

/** `<input type="date">` speaks `YYYY-MM-DD`; the record stores a UTC day bucket. */
function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

let nextKey = 0;
const newItem = (): DraftItem => ({
  key: `item-${(nextKey += 1)}`,
  title: "",
  dueDate: "",
});

export function NoteComposer({
  open,
  onClose,
  mentees,
  fixedMenteeId,
  note,
}: NoteComposerProps) {
  const editing = Boolean(note);
  const formId = useId();
  const { toast } = useToast();

  const [items, setItems] = useState<DraftItem[]>([]);

  /**
   * Success is handled inside the action, not in an effect watching `state.ok`.
   * An effect would fire an extra render pass on every save — and would not fire
   * at all on a second save that happened to return an identical state.
   */
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const submit = editing ? updateNoteAction : createNoteAction;
      const result = await submit(prev, formData);

      if (result.ok) {
        toast({
          title: editing ? "Note updated" : "Note saved",
          description: editing
            ? "Your changes are live."
            : "The mentee is notified when a note is shared or carries action items.",
          variant: "success",
        });
        setItems([]);
        onClose();
      }

      return result;
    },
    INITIAL_ACTION_STATE,
  );

  if (!open) return null;

  const menteeOptions = mentees.map((m) => ({
    value: m.id,
    label: `${m.firstName} ${m.lastName}`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit note" : "New coaching note"}
      description={
        editing
          ? "Only the author of a note may change it."
          : "A private note is you thinking out loud. A shared note reaches the mentee."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={pending}>
            {editing ? "Save changes" : "Save note"}
          </Button>
        </>
      }
    >
      <form id={formId} action={formAction} className="flex flex-col gap-5">
        {note ? <input type="hidden" name="noteId" value={note.id} /> : null}

        {fixedMenteeId || note ? (
          <input
            type="hidden"
            name="menteeId"
            value={note?.menteeId ?? fixedMenteeId}
          />
        ) : (
          <FormField label="Mentee" required>
            <Select
              name="menteeId"
              options={menteeOptions}
              placeholder="Who is this note about?"
            />
          </FormField>
        )}

        <FormField label="Title" required>
          <Input
            name="title"
            defaultValue={note?.title ?? ""}
            placeholder="Momentum on the professional goals"
            maxLength={140}
          />
        </FormField>

        <FormField
          label="Note"
          hint="Basic HTML is allowed — <p>, <strong>, <em>, <ul>, <li>, <a>. The server applies an allow-list when it saves."
        >
          <Textarea
            name="body"
            rows={8}
            defaultValue={note?.body ?? ""}
            placeholder="<p>What you observed, and what you want them to do about it.</p>"
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Visibility" required>
            <Select
              name="visibility"
              options={VISIBILITY_OPTIONS}
              defaultValue={note?.visibility ?? "PRIVATE"}
            />
          </FormField>

          <FormField
            label="Follow up on"
            hint="Surfaces in your follow-ups queue."
          >
            <Input
              type="date"
              name="followUpDate"
              defaultValue={toDateInput(note?.followUpDate)}
            />
          </FormField>
        </div>

        {editing ? null : (
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-strong">
                  Action items
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Work you are handing the mentee. They are notified when the
                  note is saved.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus />}
                onClick={() => setItems((current) => [...current, newItem()])}
              >
                Add
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted">
                No action items — this note is an observation only.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map((item, index) => (
                  <li
                    key={item.key}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface-sunken p-3 sm:flex-row sm:items-center"
                  >
                    <Input
                      name="actionItemTitle"
                      aria-label={`Action item ${index + 1}`}
                      placeholder="Book the two discovery calls"
                      className="flex-1"
                      value={item.title}
                      onChange={(event) => {
                        const { value } = event.target;
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key
                              ? { ...row, title: value }
                              : row,
                          ),
                        );
                      }}
                    />
                    <Input
                      type="date"
                      name="actionItemDue"
                      aria-label={`Due date for action item ${index + 1}`}
                      className="sm:w-44"
                      value={item.dueDate}
                      onChange={(event) => {
                        const { value } = event.target;
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key
                              ? { ...row, dueDate: value }
                              : row,
                          ),
                        );
                      }}
                    />

                    <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
                      <input
                        type="checkbox"
                        checked
                        disabled
                        readOnly
                        aria-label="Assigned to the mentee"
                        className="size-4 accent-[var(--primary)]"
                      />
                      Assigned to mentee
                    </label>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove action item ${index + 1}`}
                      icon={<Trash2 />}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((row) => row.key !== item.key),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted">
              An action item on a coaching note is always assigned to the mentee
              it is about — that is what makes it theirs to close.
            </p>
          </div>
        )}

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-400"
          >
            {state.error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
