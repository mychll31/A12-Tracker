import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { listMentees } from "@/server/mentees";

import { errorResponse, query, unauthorized } from "../_lib/http";

const listSchema = z.object({
  groupId: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = listSchema.parse(query(request));

    // Scoped by visibleUserIds inside: a coach sees the org, a mentee sees only
    // their own group.
    const mentees = await listMentees(user, input);
    return NextResponse.json({ mentees });
  } catch (error) {
    return errorResponse(error);
  }
}
