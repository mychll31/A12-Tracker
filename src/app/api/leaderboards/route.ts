import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { LEADERBOARD_BOARDS } from "@/lib/domain";
import { getLeaderboard } from "@/server/leaderboards";

import { errorResponse, query, unauthorized } from "../_lib/http";

const boardSchema = z.object({
  board: z.enum(LEADERBOARD_BOARDS).default("GROUP"),
  // Omitted means "the natural scope for this actor" — the server resolves it,
  // and refuses a scope the actor may not open.
  scope: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { board, scope } = boardSchema.parse(query(request));
    const rows = await getLeaderboard(user, board, scope);

    return NextResponse.json({ board, scope: scope ?? null, rows });
  } catch (error) {
    return errorResponse(error);
  }
}
