"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Plus, Send, UsersRound } from "lucide-react";

import {
  Button,
  FormField,
  Modal,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { assignMenteeAction, reviewCheckInAction } from "../../actions";
import { INITIAL_ACTION_STATE } from "../../../_lib/form-state";
import { NoteComposer } from "../../note-composer";
import type { ActionState } from "../../../_lib/form-state";

/**
 * The two write affordances on a mentee's drilldown. Both are open to any coach
 * who can see the mentee — reviewing a check-in and writing a note are
 * observations, not edits, so neither is gated on `canEdit`.
 */

export function ReviewBox({
  checkInId,
  menteeId,
  menteeFirstName,
}: {
  checkInId: string;
  menteeId: string;
  menteeFirstName: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  /**
   * Clearing the box happens inside the action. Keyed off `state.ok` in an
   * effect it would fire once and then never again — a second review in a row
   * returns the same `ok`, leaving the coach's previous words sitting in the box.
   */
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await reviewCheckInAction(prev, formData);

      if (result.ok) {
        toast({
          title: "Review posted",
          description: `${menteeFirstName} has been notified.`,
          variant: "success",
        });
        form.current?.reset();
      }

      return result;
    },
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      ref={form}
      action={formAction}
      className="mt-4 flex flex-col gap-2 border-t border-border pt-4"
    >
      <input type="hidden" name="checkInId" value={checkInId} />
      <input type="hidden" name="menteeId" value={menteeId} />

      <Textarea
        name="comment"
        rows={2}
        aria-label="Leave a review on this check-in"
        placeholder={`Respond to ${menteeFirstName}…`}
      />

      {state.error ? (
        <p role="alert" className="text-xs text-rose-500 dark:text-rose-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          icon={<Send />}
          isLoading={pending}
        >
          Leave a review
        </Button>
      </div>
    </form>
  );
}

export function NewNoteButton({
  menteeId,
  firstName,
  lastName,
}: {
  menteeId: string;
  firstName: string;
  lastName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>
        New note
      </Button>

      <NoteComposer
        open={open}
        onClose={() => setOpen(false)}
        fixedMenteeId={menteeId}
        // The subject is fixed from the drilldown, so the picker never opens and
        // this single-entry list is all the composer needs.
        mentees={[{ id: menteeId, firstName, lastName }]}
      />
    </>
  );
}

/**
 * Moves this mentee into one of the coach's own councils. The options are the
 * coach's councils only, and the server re-checks ownership — a coach can place
 * a mentee into a council they lead, never one they don't.
 */
export function ChangeCouncilButton({
  menteeId,
  firstName,
  councils,
  currentCouncilId,
}: {
  menteeId: string;
  firstName: string;
  councils: { id: string; name: string }[];
  currentCouncilId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { toast } = useToast();

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await assignMenteeAction(prev, formData);
      if (result.ok) {
        toast({
          title: "Council changed",
          description: `${firstName} was moved into your council.`,
          variant: "success",
        });
        setOpen(false);
      }
      return result;
    },
    INITIAL_ACTION_STATE,
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon={<UsersRound />}
        onClick={() => setOpen(true)}
      >
        Change council
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Move to one of your councils"
        description={`A mentee belongs to one council at a time — moving ${firstName} here closes their current membership.`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={pending}>
              Move mentee
            </Button>
          </>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="menteeId" value={menteeId} />

          <FormField label="Council" required>
            <Select
              name="groupId"
              placeholder="Choose a council"
              defaultValue={
                currentCouncilId &&
                councils.some((c) => c.id === currentCouncilId)
                  ? currentCouncilId
                  : undefined
              }
              options={councils.map((council) => ({
                value: council.id,
                label:
                  council.id === currentCouncilId
                    ? `${council.name} (current)`
                    : council.name,
              }))}
            />
          </FormField>

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
    </>
  );
}
