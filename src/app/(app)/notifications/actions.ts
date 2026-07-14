"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { NOTIFICATION_TYPES } from "@/lib/domain";
import { ForbiddenError } from "@/lib/rbac";
import { markAllRead, markRead, setPreference } from "@/server/notifications";

export type NotificationState = { error: string | null };

const OK: NotificationState = { error: null };

const idSchema = z.object({
  id: z.string().min(1, "That notification is not valid."),
});

const preferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  inApp: z.boolean(),
});

/**
 * Every action here acts on `requireUser()` and never on an id from the form.
 * A notification is private to its recipient — `markRead` refuses a row that
 * belongs to somebody else, and a missing row fails identically, so this cannot
 * be used to probe which notification ids exist.
 */
export async function markReadAction(id: string): Promise<NotificationState> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireUser();

  try {
    await markRead(user, parsed.data.id);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    throw error;
  }

  revalidatePath("/notifications");
  return OK;
}

export async function markAllReadAction(): Promise<NotificationState> {
  const user = await requireUser();
  await markAllRead(user);

  revalidatePath("/notifications");
  return OK;
}

export async function setPreferenceAction(
  type: string,
  inApp: boolean,
): Promise<NotificationState> {
  const parsed = preferenceSchema.safeParse({ type, inApp });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireUser();
  await setPreference(user, parsed.data.type, { inApp: parsed.data.inApp });

  revalidatePath("/notifications");
  return OK;
}
