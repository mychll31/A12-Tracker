import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  GOAL_CATEGORY_KEYS,
  GOAL_DIRECTIONS,
  GOAL_STATUSES,
  GOAL_TYPES,
  TARGET_PERIODS,
} from "@/lib/domain";
import { createGoal, listGoals } from "@/server/goals";

import {
  body,
  errorResponse,
  isoDate,
  query,
  unauthorized,
} from "../_lib/http";

const listSchema = z.object({
  userId: z.string().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  categoryKey: z.enum(GOAL_CATEGORY_KEYS).optional(),
});

const createSchema = z.object({
  userId: z.string().optional(),
  categoryKey: z.enum(GOAL_CATEGORY_KEYS),
  title: z.string().min(1, "A title is required."),
  description: z.string().optional(),
  targetDate: isoDate,
  notes: z.string().optional(),
  // A MERIT goal needs targetValue > 0; a MILESTONE goal needs at least one
  // task. createGoal enforces both (returning a 403 with the reason), so a
  // caller must send the fields that satisfy the type they pick.
  goalType: z.enum(GOAL_TYPES).optional(),
  targetPeriod: z.enum(TARGET_PERIODS).optional(),
  direction: z.enum(GOAL_DIRECTIONS).optional(),
  targetValue: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  unit: z.string().max(20).optional(),
  tasks: z.array(z.string().min(1)).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { userId, ...filter } = listSchema.parse(query(request));

    // Reading another user's goals is allowed or refused by assertCanViewUser
    // inside listGoals — the default is simply "me".
    const goals = await listGoals(user, userId ?? user.id, filter);
    return NextResponse.json({ goals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = createSchema.parse(await body(request));

    const id = await createGoal(user, {
      ...input,
      userId: input.userId ?? user.id,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
