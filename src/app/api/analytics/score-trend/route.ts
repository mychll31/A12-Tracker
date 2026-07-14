import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { userScoreTrend } from "@/server/analytics";

import { days, errorResponse, query, unauthorized } from "../../_lib/http";

const trendSchema = z.object({
  userId: z.string().optional(),
  days: days.default(30),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = trendSchema.parse(query(request));

    // Read from the snapshot table, not re-derived: a snapshot is the record of
    // what the score actually was on that day.
    const trend = await userScoreTrend(
      user,
      input.userId ?? user.id,
      input.days,
    );

    return NextResponse.json({ trend });
  } catch (error) {
    return errorResponse(error);
  }
}
