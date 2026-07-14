import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { taskHistory } from "@/server/core-tasks";

import { days, errorResponse, query, unauthorized } from "../../_lib/http";

const historySchema = z.object({
  userId: z.string().optional(),
  days: days.default(30),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = historySchema.parse(query(request));

    const history = await taskHistory(
      user,
      input.userId ?? user.id,
      input.days,
    );

    return NextResponse.json({ history });
  } catch (error) {
    return errorResponse(error);
  }
}
