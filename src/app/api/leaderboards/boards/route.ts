import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { availableBoards } from "@/server/leaderboards";

import { errorResponse, unauthorized } from "../../_lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    // Already filtered by role: a board the actor may not open is never offered.
    const boards = await availableBoards(user);
    return NextResponse.json({ boards });
  } catch (error) {
    return errorResponse(error);
  }
}
