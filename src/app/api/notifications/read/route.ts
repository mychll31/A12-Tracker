import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { markAllRead, markRead, unreadCount } from "@/server/notifications";

import { body, errorResponse, unauthorized } from "../../_lib/http";

/** Either one notification, or the whole inbox — never neither. */
const readSchema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = readSchema.parse(await body(request));

    if ("all" in input) {
      await markAllRead(user);
    } else {
      // Someone else's id and a missing id fail identically, so this cannot be
      // used to probe which notification ids exist.
      await markRead(user, input.id);
    }

    return NextResponse.json({
      ok: true,
      unreadCount: await unreadCount(user.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
