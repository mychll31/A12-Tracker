"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { GOAL_CATEGORY_KEYS, GOAL_STATUSES } from "@/lib/domain";
import { ForbiddenError } from "@/lib/rbac";
import {
  addGoalComment,
  addGoalTask,
  createGoal,
  deleteGoal,
  toggleGoalTask,
  updateGoal,
} from "@/server/goals";

import type { GoalFormState } from "../_lib/form-state";


const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `<input type="date">` yields `YYYY-MM-DD`; every date column is a midnight-UTC bucket. */
const dayField = z
  .string()
  .regex(ISO_DAY, "Pick a target date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const optionalText = z
  .string()
  .max(5000)
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

/** ForbiddenError is the server layer saying "no" — it is a message, not a crash. */
function asFormError(error: unknown): GoalFormState {
  if (error instanceof ForbiddenError) return { error: error.message };
  throw error;
}

/**
 * A goal is scored by the weighted share of its tasks that are done, so a goal
 * with no tasks could only ever score zero. `createGoal` throws a ForbiddenError
 * on an empty list; this rejects it first, with the same message.
 */
const taskList = z
  .array(z.string())
  .transform((values) =>
    values.map((value) => value.trim()).filter((value) => value.length > 0),
  )
  .refine((values) => values.length > 0, {
    message:
      "Add at least one task to this goal — a goal is scored by the work inside it.",
  });

const createSchema = z.object({
  userId: z.string().min(1).optional(),
  title: z.string().min(3, "Give the goal a title of at least 3 characters."),
  description: optionalText,
  categoryKey: z.enum(GOAL_CATEGORY_KEYS),
  targetDate: dayField,
  notes: optionalText,
  tasks: taskList,
});

export async function createGoalAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = createSchema.safeParse({
    userId: formData.get("userId") ?? undefined,
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    categoryKey: formData.get("categoryKey"),
    targetDate: formData.get("targetDate"),
    notes: formData.get("notes") ?? undefined,
    tasks: formData.getAll("task").map((value) => String(value)),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // A coach may set a goal for a mentee; assertCanEditMentee decides whether the
  // mentee is theirs. Anyone else only ever writes their own.
  const canActForOthers = actor.isCoach || actor.isAdmin;
  const userId =
    canActForOthers && parsed.data.userId ? parsed.data.userId : actor.id;

  let goalId: string;
  try {
    goalId = await createGoal(actor, {
      userId,
      categoryKey: parsed.data.categoryKey,
      title: parsed.data.title.trim(),
      description: parsed.data.description,
      targetDate: parsed.data.targetDate,
      notes: parsed.data.notes,
      tasks: parsed.data.tasks,
    });
  } catch (error) {
    // Includes the ForbiddenError createGoal throws when the task list is empty —
    // surfaced as a form message, never a 500.
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect(`/goals/${goalId}`);
}

const updateSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().min(3, "Give the goal a title of at least 3 characters."),
  description: optionalText,
  status: z.enum(GOAL_STATUSES),
  targetDate: dayField,
  notes: optionalText,
});

export async function updateGoalAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = updateSchema.safeParse({
    goalId: formData.get("goalId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
    targetDate: formData.get("targetDate"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await updateGoal(actor, parsed.data.goalId, {
      title: parsed.data.title.trim(),
      description: parsed.data.description ?? "",
      status: parsed.data.status,
      targetDate: parsed.data.targetDate,
      notes: parsed.data.notes ?? "",
    });
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/dashboard");

  return { error: null };
}

/** The status changer posts nothing but a status — the rest of the goal is untouched. */
const statusSchema = z.object({
  goalId: z.string().min(1),
  status: z.enum(GOAL_STATUSES),
});

export async function setGoalStatusAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = statusSchema.safeParse({
    goalId: formData.get("goalId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await updateGoal(actor, parsed.data.goalId, { status: parsed.data.status });
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/dashboard");

  return { error: null };
}

const deleteSchema = z.object({ goalId: z.string().min(1) });

export async function deleteGoalAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = deleteSchema.safeParse({ goalId: formData.get("goalId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await deleteGoal(actor, parsed.data.goalId);
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect("/goals");
}

const commentSchema = z.object({
  goalId: z.string().min(1),
  body: z.string().min(1, "Write something first."),
  isPrivate: z.enum(["true", "false"]).optional(),
});

export async function addCommentAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = commentSchema.safeParse({
    goalId: formData.get("goalId"),
    body: formData.get("body"),
    isPrivate: formData.get("isPrivate") ?? undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // "Coach only" is a coaching-team affordance. A mentee cannot hide a comment
  // on their own goal from their coach.
  const isPrivate =
    (actor.isCoach || actor.isAdmin) && parsed.data.isPrivate === "true";

  try {
    await addGoalComment(
      actor,
      parsed.data.goalId,
      parsed.data.body.trim(),
      isPrivate,
    );
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath(`/goals/${parsed.data.goalId}`);

  return { error: null };
}

const goalTaskSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().min(1, "Name the task."),
});

export async function addGoalTaskAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = goalTaskSchema.safeParse({
    goalId: formData.get("goalId"),
    title: formData.get("title"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await addGoalTask(actor, parsed.data.goalId, parsed.data.title.trim());
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/dashboard");

  return { error: null };
}

const toggleSchema = z.object({
  goalId: z.string().min(1),
  goalTaskId: z.string().min(1),
});

export async function toggleGoalTaskAction(
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = toggleSchema.safeParse({
    goalId: formData.get("goalId"),
    goalTaskId: formData.get("goalTaskId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    // Progress is derived server-side from the task list — the client never
    // sends a percentage.
    await toggleGoalTask(actor, parsed.data.goalTaskId);
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/dashboard");

  return { error: null };
}
