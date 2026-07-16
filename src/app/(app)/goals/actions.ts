"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  ACTION_PLAN_STATUSES,
  GOAL_CATEGORY_KEYS,
  GOAL_DIRECTIONS,
  GOAL_STATUSES,
} from "@/lib/domain";
import { ForbiddenError } from "@/lib/rbac";
import {
  addActionPlan,
  addGoalComment,
  createGoal,
  deleteActionPlan,
  deleteGoal,
  setActionPlanStatus,
  setGoalMeasure,
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

const measureField = z.coerce.number().min(0).max(1_000_000_000).default(0);

const createSchema = z.object({
  userId: z.string().min(1).optional(),
  title: z.string().min(3, "Give the goal a title of at least 3 characters."),
  description: optionalText,
  categoryKey: z.enum(GOAL_CATEGORY_KEYS),
  direction: z.enum(GOAL_DIRECTIONS).default("GAIN"),
  targetValue: measureField,
  currentValue: measureField,
  unit: z
    .string()
    .max(20)
    .optional()
    .transform((value) => (value ? value.trim() : "")),
  targetDate: dayField,
  notes: optionalText,
  // Action plans are optional — a goal is scored by its measure, not its plans.
  plans: z
    .array(z.string())
    .transform((values) =>
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
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
    direction: formData.get("direction") ?? "GAIN",
    targetValue: formData.get("targetValue") ?? 0,
    currentValue: formData.get("currentValue") ?? 0,
    unit: formData.get("unit") ?? undefined,
    targetDate: formData.get("targetDate"),
    notes: formData.get("notes") ?? undefined,
    plans: formData.getAll("task").map((value) => String(value)),
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
      direction: parsed.data.direction,
      targetValue: parsed.data.targetValue,
      currentValue: parsed.data.currentValue,
      unit: parsed.data.unit,
      tasks: parsed.data.plans,
    });
  } catch (error) {
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
  direction: z.enum(GOAL_DIRECTIONS).default("GAIN"),
  targetValue: measureField,
  currentValue: measureField,
  unit: z
    .string()
    .max(20)
    .optional()
    .transform((value) => (value ? value.trim() : "")),
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
    direction: formData.get("direction") ?? "GAIN",
    targetValue: formData.get("targetValue") ?? 0,
    currentValue: formData.get("currentValue") ?? 0,
    unit: formData.get("unit") ?? undefined,
    targetDate: formData.get("targetDate"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await updateGoal(actor, parsed.data.goalId, {
      title: parsed.data.title.trim(),
      description: parsed.data.description ?? "",
      status: parsed.data.status,
      direction: parsed.data.direction,
      targetValue: parsed.data.targetValue,
      currentValue: parsed.data.currentValue,
      unit: parsed.data.unit,
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

const actionPlanAddSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().min(1, "Name the action plan."),
});

export async function addActionPlanAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = actionPlanAddSchema.safeParse({
    goalId: formData.get("goalId"),
    title: formData.get("title"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await addActionPlan(actor, parsed.data.goalId, parsed.data.title.trim());
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath(`/goals/${parsed.data.goalId}`);
  return { error: null };
}

const planStatusSchema = z.object({
  goalId: z.string().min(1),
  goalTaskId: z.string().min(1),
  status: z.enum(ACTION_PLAN_STATUSES),
});

/** Cycles an action plan's status. Never touches the goal score (the measure). */
export async function setActionPlanStatusAction(
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = planStatusSchema.safeParse({
    goalId: formData.get("goalId"),
    goalTaskId: formData.get("goalTaskId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await setActionPlanStatus(actor, parsed.data.goalTaskId, parsed.data.status);
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath(`/goals/${parsed.data.goalId}`);
  return { error: null };
}

const planIdSchema = z.object({
  goalId: z.string().min(1),
  goalTaskId: z.string().min(1),
});

export async function deleteActionPlanAction(
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = planIdSchema.safeParse({
    goalId: formData.get("goalId"),
    goalTaskId: formData.get("goalTaskId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await deleteActionPlan(actor, parsed.data.goalTaskId);
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath(`/goals/${parsed.data.goalId}`);
  return { error: null };
}

const measureSchema = z.object({
  goalId: z.string().min(1),
  currentValue: z.coerce.number().min(0).max(1_000_000_000),
});

/** Updates the goal's "current" measure — this is what moves the goal score. */
export async function setMeasureAction(
  formData: FormData,
): Promise<GoalFormState> {
  const actor = await requireUser();

  const parsed = measureSchema.safeParse({
    goalId: formData.get("goalId"),
    currentValue: formData.get("currentValue"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await setGoalMeasure(actor, parsed.data.goalId, parsed.data.currentValue);
  } catch (error) {
    return asFormError(error);
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/dashboard");
  return { error: null };
}
