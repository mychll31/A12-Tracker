import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { addGoalComment } from "@/server/goals";

import { body, errorResponse, unauthorized } from "../../../_lib/http";

type Context = { params: Promise<{ id: string }> };

const commentSchema = z.object({
  body: z.string().min(1, "Write something first."),
  // A private comment is coach-eyes-only, and never notifies the mentee.
  isPrivate: z.boolean().default(false),
});

export async function POST(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const input = commentSchema.parse(await body(request));

    await addGoalComment(user, id, input.body, input.isPrivate);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
