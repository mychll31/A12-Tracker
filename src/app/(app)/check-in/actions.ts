"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { upsertCheckIn } from "@/server/check-ins";

import type { CheckInState } from "../_lib/form-state";


const optionalText = z
  .string()
  .max(5000)
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const checkInSchema = z.object({
  mood: z.coerce
    .number()
    .int()
    .min(1, "Pick how today felt.")
    .max(5, "Pick how today felt."),
  wins: optionalText,
  challenges: optionalText,
  lessons: optionalText,
  gratitude: optionalText,
  tomorrowFocus: optionalText,
});

export async function submitCheckIn(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const actor = await requireUser();

  const parsed = checkInSchema.safeParse({
    mood: formData.get("mood"),
    wins: formData.get("wins") ?? undefined,
    challenges: formData.get("challenges") ?? undefined,
    lessons: formData.get("lessons") ?? undefined,
    gratitude: formData.get("gratitude") ?? undefined,
    tomorrowFocus: formData.get("tomorrowFocus") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, saved: false };
  }

  try {
    // The date is left to the server layer: a check-in is always for today, and
    // upsertCheckIn keys it on today's day bucket, so this edits rather than
    // duplicates.
    await upsertCheckIn(actor, { userId: actor.id, ...parsed.data });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { error: error.message, saved: false };
    }
    throw error;
  }

  revalidatePath("/check-in");
  revalidatePath("/dashboard");

  return { error: null, saved: true };
}
