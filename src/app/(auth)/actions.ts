"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  authenticate,
  createSession,
  destroySession,
  hashPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { NOTIFICATION_TYPES } from "@/lib/domain";

export type AuthState = { error: string | null };

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
});

/** `next` arrives from the query string, so only same-origin paths are honoured. */
function safeRedirect(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const result = await authenticate(parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  await createSession(result.userId);
  redirect(safeRedirect(formData.get("next")));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  // Self-service signup joins the default organization as a mentee. A coach
  // then places them in a coaching group; an admin grants any further roles.
  const organization = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!organization) {
    return {
      error: "No organization is configured yet. Run `npm run db:seed`.",
    };
  }

  const menteeRole = await db.role.findUnique({
    where: { key: "MENTEE" },
    select: { id: true },
  });
  if (!menteeRole) {
    return { error: "Roles are not configured. Run `npm run db:seed`." };
  }

  const user = await db.user.create({
    data: {
      organizationId: organization.id,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      roles: { create: [{ roleId: menteeRole.id }] },
      notificationPrefs: {
        create: NOTIFICATION_TYPES.map((type) => ({ type, inApp: true })),
      },
    },
    select: { id: true },
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
