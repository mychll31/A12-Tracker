"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

import type { ProfileState } from "../_lib/form-state";


/** An empty optional field is stored as NULL, never as "". */
const blankToNull = (value: string): string | null =>
  value.length > 0 ? value : null;

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  headline: z
    .string()
    .trim()
    .max(120, "Keep your headline under 120 characters."),
  bio: z.string().trim().max(1000, "Keep your bio under 1000 characters."),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    // The avatar is rendered as an <img src>. Pinning it to http(s) is what stops
    // a `javascript:` or `data:` URL ever reaching the DOM.
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Enter a URL starting with http:// or https://",
    ),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z
    .string()
    .min(10, "Use at least 10 characters.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
});

/**
 * Operates on `requireUser().id` and nothing else. The form never carries a
 * userId, so there is no id here to forge.
 */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: null };
  }

  const { firstName, lastName, headline, bio, avatarUrl } = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      headline: blankToNull(headline),
      bio: blankToNull(bio),
      avatarUrl: blankToNull(avatarUrl),
    },
  });

  revalidatePath("/profile");
  return { error: null, success: "Profile updated." };
}

export async function changePassword(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: null };
  }

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!row) {
    return { error: "That account no longer exists.", success: null };
  }

  // Proving you hold the current password is what makes this a *change* rather
  // than a takeover — a stolen session must not be enough to lock the owner out.
  const matches = await verifyPassword(
    parsed.data.currentPassword,
    row.passwordHash,
  );

  if (!matches) {
    return { error: "Your current password is incorrect.", success: null };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  revalidatePath("/profile");
  return { error: null, success: "Password changed." };
}
