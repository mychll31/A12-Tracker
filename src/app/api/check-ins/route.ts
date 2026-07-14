import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { today } from "@/lib/dates";
import { getCheckIn, upsertCheckIn } from "@/server/check-ins";

import {
  body,
  errorResponse,
  optionalIsoDate,
  query,
  unauthorized,
} from "../_lib/http";

const readSchema = z.object({
  userId: z.string().optional(),
  date: optionalIsoDate,
});

const upsertSchema = z.object({
  userId: z.string().optional(),
  date: optionalIsoDate,
  wins: z.string().optional(),
  challenges: z.string().optional(),
  lessons: z.string().optional(),
  gratitude: z.string().optional(),
  tomorrowFocus: z.string().optional(),
  mood: z.number().int().min(1).max(5),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = readSchema.parse(query(request));

    // null is a legitimate answer — the day simply has no check-in yet.
    const checkIn = await getCheckIn(
      user,
      input.userId ?? user.id,
      input.date ?? today(),
    );

    return NextResponse.json({ checkIn });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const input = upsertSchema.parse(await body(request));
    const userId = input.userId ?? user.id;
    const date = input.date ?? today();

    // One row per person per day: re-posting edits today's entry rather than
    // stacking a second one behind it.
    const id = await upsertCheckIn(user, { ...input, userId, date });
    const checkIn = await getCheckIn(user, userId, date);

    return NextResponse.json({ id, checkIn });
  } catch (error) {
    return errorResponse(error);
  }
}
