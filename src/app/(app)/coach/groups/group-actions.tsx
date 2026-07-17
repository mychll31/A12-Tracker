"use client";

import { useActionState, useId, useState } from "react";
import { Pencil, Plus, UserMinus, UserPlus } from "lucide-react";

import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";

import {
  assignMenteeAction,
  createGroupAction,
  removeMenteeAction,
  updateGroupAction,
} from "../actions";
import { INITIAL_ACTION_STATE } from "../../_lib/form-state";
import type { ActionState } from "../../_lib/form-state";

/**
 * Group writes. Both actions are refused server-side for a coach acting outside
 * their own groups — these buttons only decide whether it is worth offering.
 */

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-400"
    >
      {message}
    </p>
  );
}

export function NewGroupButton() {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { toast } = useToast();

  // Closing on success happens inside the action rather than in an effect
  // watching it — see the note in note-composer.tsx.
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await createGroupAction(prev, formData);

      if (result.ok) {
        toast({
          title: "Council created",
          description: "You lead it — start placing mentees into it.",
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
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        New council
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New council"
        description="You will lead this council. A coach may only create councils they run themselves."
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
              Create council
            </Button>
          </>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-5">
          <FormField label="Name" required>
            <Input name="name" placeholder="Thursday Momentum" maxLength={80} />
          </FormField>

          <FormField
            label="Description"
            hint="What this council is for. Optional."
          >
            <Textarea
              name="description"
              rows={3}
              maxLength={500}
              placeholder="A cohort working through their first ninety days."
            />
          </FormField>

          {state.error ? <ErrorNote message={state.error} /> : null}
        </form>
      </Modal>
    </>
  );
}

export function AddMenteeButton({
  groupId,
  candidates,
}: {
  groupId: string;
  /** Mentees not already in this group. */
  candidates: { id: string; firstName: string; lastName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { toast } = useToast();

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await assignMenteeAction(prev, formData);

      if (result.ok) {
        toast({
          title: "Mentee added",
          description: "They now sit in this council.",
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
        icon={<UserPlus />}
        onClick={() => setOpen(true)}
      >
        Add mentee
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a mentee to this council"
        description="A mentee belongs to one council at a time — adding them here moves them out of any council they are currently in."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              isLoading={pending}
              disabled={candidates.length === 0}
            >
              Add to council
            </Button>
          </>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="groupId" value={groupId} />

          {candidates.length === 0 ? (
            <p className="text-sm text-muted">
              Every mentee in the organization is already in this council.
            </p>
          ) : (
            <FormField label="Mentee" required>
              <Select
                name="menteeId"
                placeholder="Choose someone"
                options={candidates.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                }))}
              />
            </FormField>
          )}

          {state.error ? <ErrorNote message={state.error} /> : null}
        </form>
      </Modal>
    </>
  );
}

export function EditGroupButton({
  groupId,
  currentName,
}: {
  groupId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { toast } = useToast();

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await updateGroupAction(prev, formData);

      if (result.ok) {
        toast({
          title: "Council renamed",
          description: "The new name is visible across council views.",
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
        icon={<Pencil />}
        onClick={() => setOpen(true)}
      >
        Edit name
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit council name"
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
              Save name
            </Button>
          </>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="groupId" value={groupId} />

          <FormField label="Name" required>
            <Input
              name="name"
              defaultValue={currentName}
              maxLength={80}
              required
            />
          </FormField>

          {state.error ? <ErrorNote message={state.error} /> : null}
        </form>
      </Modal>
    </>
  );
}

export function RemoveMenteeButton({
  groupId,
  menteeId,
  menteeName,
}: {
  groupId: string;
  menteeId: string;
  menteeName: string;
}) {
  const { toast } = useToast();

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await removeMenteeAction(prev, formData);

      if (result.ok) {
        toast({
          title: "Mentee removed",
          description: `${menteeName} no longer sits in this council.`,
          variant: "success",
        });
      } else if (result.error) {
        toast({
          title: "Could not remove mentee",
          description: result.error,
          variant: "danger",
        });
      }

      return result;
    },
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Remove ${menteeName} from this council? They will be left without a council.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="inline-flex justify-end"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="menteeId" value={menteeId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        icon={<UserMinus />}
        isLoading={pending}
        aria-label={`Remove ${menteeName} from this council`}
      >
        Remove
      </Button>
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}
