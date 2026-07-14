import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { today } from "@/lib/dates";
import { getTaskBoard, toggleCoreTask } from "@/server/core-tasks";

import {
  body,
  errorResponse,
  optionalIsoDate,
  query,
  unauthorized,
} from "../_lib/http";

const boardSchema = z.object({
  userId: z.string().optional(),
  date: optionalIsoDate,
});

const toggleSchema = z.object({
  userId: z.string().optional(),
  coreTaskId: z.string().min(1, "Name the core task."),
  date: optionalIsoDate,
  completed: z.boolean(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = boardSchema.parse(query(request));

    const board = await getTaskBoard(
      user,
      input.userId ?? user.id,
      input.date ?? today(),
    );

    return NextResponse.json({ board });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = toggleSchema.parse(await body(request));

    const userId = input.userId ?? user.id;
    const date = input.date ?? today();

    await toggleCoreTask(user, {
      userId,
      coreTaskId: input.coreTaskId,
      date,
      completed: input.completed,
      notes: input.notes,
    });

    // Hand back the board rather than an ack: the caller's next render needs
    // the new percent and count anyway.
    const board = await getTaskBoard(user, userId, date);
    return NextResponse.json({ board });
  } catch (error) {
    return errorResponse(error);
  }
}
