import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { recentActivity } from "@/server/activity";

import { errorResponse, query, unauthorized } from "../_lib/http";

const activitySchema = z.object({
  userId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = activitySchema.parse(query(request));

    // Without a userId this returns every timeline the actor may see, which for
    // a coach or admin is the whole organization.
    const activity = await recentActivity(user, input);
    return NextResponse.json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
