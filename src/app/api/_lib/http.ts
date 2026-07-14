import { NextResponse } from "next/server";
import { z } from "zod";

import { dayKey } from "@/lib/dates";
import { ForbiddenError } from "@/lib/rbac";

/**
 * The JSON contract every route in this tree shares.
 *
 * `_lib` is a Next private folder: the underscore keeps it out of the router, so
 * this never becomes an endpoint of its own.
 *
 * Note that middleware deliberately excludes /api — an unauthenticated request
 * must come back as 401 JSON, not a 307 to the HTML login page, or every fetch()
 * would silently receive a login form and try to parse it.
 */

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function errorResponse(error: unknown): NextResponse {
  // ForbiddenError messages are written for a person to read.
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", issues: error.issues },
      { status: 400 },
    );
  }

  // Everything else is ours, not theirs: log it, hand back nothing that could
  // leak a stack, a table name or a file path.
  console.error("[api]", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Every daily record is keyed to midnight UTC, so every `date` param must be too. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date: YYYY-MM-DD.")
  .transform((value) => dayKey(new Date(`${value}T00:00:00.000Z`)));

export const optionalIsoDate = isoDate.optional();

/** Trailing-window length, shared by the history and trend endpoints. */
export const days = z.coerce.number().int().min(1).max(365);

export function query(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

/**
 * A body that is absent or not JSON is a client mistake, not a server fault —
 * it becomes an empty object and fails the schema as a 400 rather than a 500.
 */
export async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
