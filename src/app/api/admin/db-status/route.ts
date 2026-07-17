import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const tables = [
  "organizations",
  "users",
  "roles",
  "user_roles",
  "coach_groups",
  "group_memberships",
  "goal_categories",
  "goals",
  "goal_tasks",
  "merit_logs",
  "core_tasks",
] as const;

function databaseUrlSummary() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  let parsed: URL | null = null;
  try {
    parsed = url ? new URL(url) : null;
  } catch {
    parsed = null;
  }
  const withoutQuery = parsed
    ? `${parsed.protocol}//${parsed.host}${parsed.pathname}`
    : url.split("?")[0] ?? url;
  const kind = url.startsWith("libsql://")
    ? "libsql"
    : url.startsWith("file:")
      ? "file"
      : url
        ? "other"
        : "empty";

  return {
    kind,
    source: process.env.DATABASE_URL
      ? "DATABASE_URL"
      : process.env.TURSO_DATABASE_URL
        ? "TURSO_DATABASE_URL"
        : "missing",
    host: parsed?.host ?? null,
    path: parsed?.pathname ?? null,
    hash: url
      ? createHash("sha256").update(url).digest("hex").slice(0, 12)
      : null,
    stableHash: withoutQuery
      ? createHash("sha256").update(withoutQuery).digest("hex").slice(0, 12)
      : null,
    hasQuery: Boolean(parsed?.search),
    authTokenSource: process.env.DATABASE_AUTH_TOKEN
      ? "DATABASE_AUTH_TOKEN"
      : process.env.TURSO_AUTH_TOKEN
        ? "TURSO_AUTH_TOKEN"
        : "missing",
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const database = databaseUrlSummary();
  const counts: Record<string, number | string> = {};
  for (const table of tables) {
    try {
      const result = await db.$queryRawUnsafe<{ n: bigint | number }[]>(
        `SELECT count(*) AS n FROM "${table}"`,
      );
      const value = result[0]?.n ?? 0;
      counts[table] = typeof value === "bigint" ? Number(value) : value;
    } catch (error) {
      counts[table] =
        error instanceof Error ? `error: ${error.message}` : "error";
    }
  }

  return NextResponse.json({
    database,
    counts,
  });
}
