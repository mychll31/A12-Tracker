import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { GOAL_STATUSES } from "@/lib/domain";
import { deleteGoal, getGoal, updateGoal } from "@/server/goals";

import { body, errorResponse, isoDate, unauthorized } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1, "A title is required.").optional(),
  description: z.string().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  targetDate: isoDate.optional(),
  notes: z.string().optional(),
});

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const goal = await getGoal(user, id);
    return NextResponse.json({ goal });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const input = patchSchema.parse(await body(request));

    await updateGoal(user, id, input);

    // Re-read rather than echo the patch: tasks own the progress bar, so
    // the number that actually landed is not necessarily the one sent.
    const goal = await getGoal(user, id);
    return NextResponse.json({ goal });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await deleteGoal(user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
