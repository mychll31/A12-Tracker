"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { toggleActionItem } from "@/server/notes";

export type ToggleState = { error: string | null };

const schema = z.object({
  itemId: z.string().min(1, "That action item is not valid."),
});

/**
 * The item id is the *only* thing the client supplies. Who may close it is
 * decided server-side by `toggleActionItem` — the assignee, the coach who set
 * it, or an admin — so a forged id from another mentee's note is refused rather
 * than trusted.
 */
export async function toggleActionItemAction(
  itemId: string,
): Promise<ToggleState> {
  const parsed = schema.safeParse({ itemId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await requireUser();

  try {
    await toggleActionItem(user, parsed.data.itemId);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/notes");
  return { error: null };
}
