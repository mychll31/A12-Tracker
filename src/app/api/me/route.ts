import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { computeUserScore } from "@/lib/scoring";

import { errorResponse, unauthorized } from "../_lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const score = await computeUserScore(user.id);
    return NextResponse.json({ user, score });
  } catch (error) {
    return errorResponse(error);
  }
}
