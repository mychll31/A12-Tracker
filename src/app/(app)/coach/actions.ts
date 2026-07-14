"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { NOTE_VISIBILITIES } from "@/lib/domain";
import { createGroup, assignMenteeToGroup } from "@/server/admin";
import { reviewCheckIn } from "@/server/check-ins";
import {
  addActionItem,
  createNote,
  deleteNote,
  toggleActionItem,
  updateNote,
} from "@/server/notes";

/**
 * Every write a coach can make from these screens.
 *
 * The server layer in src/server/** already owns permission — an action never
 * re-decides who may write, it only translates a ForbiddenError into a sentence
 * the coach can read instead of a 500.
 */

import type { ActionState } from "../_lib/form-state";


const ok = (): ActionState => ({ error: null, ok: true });
const fail = (error: string): ActionState => ({ error, ok: false });

/**
 * ForbiddenError already carries a sentence written for the person who hit it
 * ("Ask their coach to delegate access"), so it is surfaced verbatim. Anything
 * else is a bug and must not leak its message to the UI.
 */
async function guard(run: () => Promise<void>): Promise<ActionState> {
  try {
    await run();
    return ok();
  } catch (error) {
    if (error instanceof ForbiddenError) return fail(error.message);
    throw error;
  }
}

/**
 * A date input yields `YYYY-MM-DD`, which is read here as midnight UTC — the
 * same day bucket every daily record in the app is keyed to (see lib/dates).
 */
const dayInput = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const optionalDay = z
  .union([dayInput, z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const visibility = z.enum(NOTE_VISIBILITIES);

const noteFields = {
  title: z.string().trim().min(1, "Give the note a title.").max(140),
  body: z.string().max(20_000).default(""),
  visibility,
  followUpDate: optionalDay,
};

/** Action items arrive as parallel repeated fields, so they are zipped by index. */
function readActionItems(
  formData: FormData,
): { title: string; dueDate: Date | null }[] {
  const titles = formData.getAll("actionItemTitle");
  const dues = formData.getAll("actionItemDue");

  return titles.flatMap((raw, index) => {
    const title = typeof raw === "string" ? raw.trim() : "";
    if (!title) return [];

    const due = dues[index];
    const parsed =
      typeof due === "string" && due ? new Date(`${due}T00:00:00.000Z`) : null;

    return [
      {
        title,
        dueDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
      },
    ];
  });
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/** Every coach screen reads from the same handful of routes. */
function revalidateCoach(menteeId?: string): void {
  revalidatePath("/coach");
  revalidatePath("/coach/notes");
  revalidatePath("/coach/mentees");
  revalidatePath("/coach/groups");
  if (menteeId) revalidatePath(`/coach/mentees/${menteeId}`);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

const createNoteSchema = z.object({
  menteeId: z.string().min(1, "Choose a mentee."),
  ...noteFields,
});

export async function createNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = createNoteSchema.safeParse({
    menteeId: formData.get("menteeId"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    visibility: formData.get("visibility"),
    followUpDate: formData.get("followUpDate") ?? "",
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    await createNote(actor, {
      ...parsed.data,
      actionItems: readActionItems(formData),
    });
  });

  if (state.ok) revalidateCoach(parsed.data.menteeId);
  return state;
}

const updateNoteSchema = z.object({
  noteId: z.string().min(1),
  menteeId: z.string().min(1),
  ...noteFields,
});

export async function updateNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = updateNoteSchema.safeParse({
    noteId: formData.get("noteId"),
    menteeId: formData.get("menteeId"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    visibility: formData.get("visibility"),
    followUpDate: formData.get("followUpDate") ?? "",
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { noteId, menteeId, ...fields } = parsed.data;

  const state = await guard(async () => {
    await updateNote(actor, noteId, fields);
  });

  if (state.ok) revalidateCoach(menteeId);
  return state;
}

const deleteNoteSchema = z.object({
  noteId: z.string().min(1),
  menteeId: z.string().min(1),
});

export async function deleteNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = deleteNoteSchema.safeParse({
    noteId: formData.get("noteId"),
    menteeId: formData.get("menteeId"),
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    await deleteNote(actor, parsed.data.noteId);
  });

  if (state.ok) revalidateCoach(parsed.data.menteeId);
  return state;
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

const addActionItemSchema = z.object({
  noteId: z.string().min(1),
  menteeId: z.string().min(1),
  title: z.string().trim().min(1, "Describe the action item."),
  dueDate: optionalDay,
});

export async function addActionItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = addActionItemSchema.safeParse({
    noteId: formData.get("noteId"),
    menteeId: formData.get("menteeId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate") ?? "",
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    await addActionItem(
      actor,
      parsed.data.noteId,
      parsed.data.title,
      parsed.data.dueDate,
    );
  });

  if (state.ok) revalidateCoach(parsed.data.menteeId);
  return state;
}

const toggleActionItemSchema = z.object({
  itemId: z.string().min(1),
  menteeId: z.string().min(1),
});

export async function toggleActionItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = toggleActionItemSchema.safeParse({
    itemId: formData.get("itemId"),
    menteeId: formData.get("menteeId"),
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    await toggleActionItem(actor, parsed.data.itemId);
  });

  if (state.ok) revalidateCoach(parsed.data.menteeId);
  return state;
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  checkInId: z.string().min(1),
  menteeId: z.string().min(1),
  comment: z.string().trim().min(1, "Write a few words before posting."),
});

export async function reviewCheckInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = reviewSchema.safeParse({
    checkInId: formData.get("checkInId"),
    menteeId: formData.get("menteeId"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    await reviewCheckIn(actor, parsed.data.checkInId, parsed.data.comment);
  });

  if (state.ok) revalidateCoach(parsed.data.menteeId);
  return state;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Name the group."),
  description: z.string().trim().max(500).optional(),
});

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    // A coach may only open a group they will lead themselves — createGroup
    // enforces that, so the coach id is never taken from the form.
    await createGroup(actor, { ...parsed.data, coachId: actor.id });
  });

  if (state.ok) revalidateCoach();
  return state;
}

const assignMenteeSchema = z.object({
  menteeId: z.string().min(1, "Choose a mentee."),
  groupId: z.string().min(1),
});

export async function assignMenteeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireCoach();

  const parsed = assignMenteeSchema.safeParse({
    menteeId: formData.get("menteeId"),
    groupId: formData.get("groupId"),
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const state = await guard(async () => {
    await assignMenteeToGroup(actor, parsed.data.menteeId, parsed.data.groupId);
  });

  if (state.ok) {
    revalidateCoach(parsed.data.menteeId);
    revalidatePath(`/coach/groups/${parsed.data.groupId}`);
  }
  return state;
}
