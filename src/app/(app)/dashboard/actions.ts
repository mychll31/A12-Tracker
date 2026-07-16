"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { toggleCoreTask } from "@/server/core-tasks";
import { goExtraMile, logMeritTarget } from "@/server/goals";

export type ToggleTaskResult = { error: string | null };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const toggleSchema = z.object({
  userId: z.string().min(1).optional(),
  coreTaskId: z.string().min(1, "Missing task."),
  date: z.string().regex(ISO_DAY, "Invalid date."),
  completed: z.enum(["true", "false"]),
  notes: z.string().max(2000).optional(),
});

/** Day buckets are midnight UTC — the same key `dayKey()` writes in src/lib/dates.ts. */
function toDayBucket(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

export async function toggleTask(
  formData: FormData,
): Promise<ToggleTaskResult> {
  const actor = await requireUser();

  const parsed = toggleSchema.safeParse({
    userId: formData.get("userId") ?? undefined,
    coreTaskId: formData.get("coreTaskId"),
    date: formData.get("date"),
    completed: formData.get("completed"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // A mentee may only ever move their own board. A coach may act for a mentee,
  // and `assertCanEditMentee` inside toggleCoreTask decides whether that mentee
  // is actually theirs.
  const canActForOthers = actor.isCoach || actor.isAdmin;
  const userId =
    canActForOthers && parsed.data.userId ? parsed.data.userId : actor.id;

  try {
    await toggleCoreTask(actor, {
      userId,
      coreTaskId: parsed.data.coreTaskId,
      date: toDayBucket(parsed.data.date),
      completed: parsed.data.completed === "true",
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/core-tasks");

  return { error: null };
}

const meritSchema = z.object({ goalId: z.string().min(1, "Missing goal.") });
const extraSchema = z.object({
  goalId: z.string().min(1, "Missing goal."),
  amount: z.coerce.number().min(0).max(1_000_000_000),
});

function revalidateMerit() {
  revalidatePath("/core-tasks");
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

/** Logs the current period's target for a merit goal (the Core Tasks check). */
export async function logMeritTargetAction(
  formData: FormData,
): Promise<ToggleTaskResult> {
  const actor = await requireUser();
  const parsed = meritSchema.safeParse({ goalId: formData.get("goalId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await logMeritTarget(actor, parsed.data.goalId);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }

  revalidateMerit();
  return { error: null };
}

/** Logs a custom "go the extra mile" amount on a merit goal. */
export async function goExtraMileAction(
  formData: FormData,
): Promise<ToggleTaskResult> {
  const actor = await requireUser();
  const parsed = extraSchema.safeParse({
    goalId: formData.get("goalId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await goExtraMile(actor, parsed.data.goalId, parsed.data.amount);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }

  revalidateMerit();
  return { error: null };
}
