import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { listNotifications, unreadCount } from "@/server/notifications";

import { errorResponse, query, unauthorized } from "../_lib/http";

const listSchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = listSchema.parse(query(request));

    // A notification is private to its recipient — there is no userId param to
    // pass, by design. You only ever read your own inbox.
    const [notifications, unread] = await Promise.all([
      listNotifications(user.id, input),
      unreadCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount: unread });
  } catch (error) {
    return errorResponse(error);
  }
}
