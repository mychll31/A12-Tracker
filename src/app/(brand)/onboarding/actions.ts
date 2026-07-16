"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { GOAL_CATEGORY_KEYS } from "@/lib/domain";
import { ForbiddenError } from "@/lib/rbac";
import {
  completeOnboarding,
  type OnboardingSubmission,
} from "@/server/onboarding";

import type { OnboardingFormState } from "./form-state";

/**
 * Every goal carries its first task: a goal's score *is* the share of its tasks
 * that are done, and completeOnboarding refuses a goal without one.
 */
const goalSchema = z.object({
  title: z.string().trim().min(1, "Set a goal in all three realms."),
  firstTask: z
    .string()
    .trim()
    .min(
      1,
      "Give every goal a first task — a goal is scored by the work inside it.",
    ),
});

const submissionSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you."),
  goals: z.object({
    PERSONAL: goalSchema,
    PROFESSIONAL: goalSchema,
    CONTRIBUTION: goalSchema,
  }),
  mood: z.coerce
    .number()
    .int()
    .min(1, "Pick how today felt.")
    .max(5, "Pick how today felt."),
  wins: z.string().max(5000),
  // Empty when a coach already placed them; the server re-checks either way.
  circleId: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
});

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function submitOnboarding(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const actor = await requireUser();

  const goals = Object.fromEntries(
    GOAL_CATEGORY_KEYS.map((key) => [
      key,
      {
        title: text(formData, `goal:${key}:title`),
        firstTask: text(formData, `goal:${key}:task`),
      },
    ]),
  );

  const parsed = submissionSchema.safeParse({
    name: text(formData, "name"),
    goals,
    mood: text(formData, "mood"),
    wins: text(formData, "wins"),
    circleId: text(formData, "circleId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const input: OnboardingSubmission = {
    name: parsed.data.name,
    goals: parsed.data.goals,
    checkIn: { mood: parsed.data.mood, wins: parsed.data.wins },
    circleId: parsed.data.circleId,
  };

  try {
    await completeOnboarding(actor, input);
  } catch (error) {
    // The server layer saying "no" is a message to show, not a crash.
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }

  revalidatePath("/dashboard");
  // redirect() signals by throwing, so it must sit outside the try above.
  redirect("/dashboard");
}
