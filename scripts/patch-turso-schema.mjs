/**
 * Idempotent Turso/libSQL production schema patch.
 *
 * Prisma Migrate cannot run against the libsql:// protocol during Vercel's
 * serverless build. Keep this script narrow: it only applies additive columns
 * required by deployed code and skips local/non-Turso builds.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.log("patch-turso-schema: no Turso database URL; skipping.");
  process.exit(0);
}

const client = createClient({ url, authToken });

async function columns(table) {
  const result = await client.execute(`PRAGMA table_info("${table}")`);
  return new Set(result.rows.map((row) => String(row.name)));
}

async function addColumn(table, name, definition) {
  const existing = await columns(table);
  if (existing.has(name)) {
    console.log(`patch-turso-schema: ${table}.${name} exists.`);
    return false;
  }

  await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
  console.log(`patch-turso-schema: added ${table}.${name}.`);
  return true;
}

await addColumn("goals", "direction", "TEXT NOT NULL DEFAULT 'GAIN'");
await addColumn("goals", "targetValue", "REAL NOT NULL DEFAULT 0");
await addColumn("goals", "currentValue", "REAL NOT NULL DEFAULT 0");
await addColumn("goals", "unit", "TEXT NOT NULL DEFAULT ''");
await addColumn("goals", "goalType", "TEXT NOT NULL DEFAULT 'MERIT'");
const addedTargetPeriod = await addColumn(
  "goals",
  "targetPeriod",
  "TEXT NOT NULL DEFAULT 'NONE'",
);
await addColumn("goal_tasks", "status", "TEXT NOT NULL DEFAULT 'NOT_STARTED'");

await client.execute(`
  CREATE TABLE IF NOT EXISTS "merit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merit_logs_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "merit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )
`);

await client.execute(`
  CREATE INDEX IF NOT EXISTS "merit_logs_userId_date_idx"
  ON "merit_logs"("userId", "date")
`);

await client.execute(`
  CREATE UNIQUE INDEX IF NOT EXISTS "merit_logs_goalId_date_key"
  ON "merit_logs"("goalId", "date")
`);

// One-time backfill, guarded so it only runs the first time the column is
// added. NEVER add unconditional data UPDATEs here — this script runs on every
// deploy, so an `UPDATE ... WHERE targetValue = 0` would rewrite every Milestone
// goal (which legitimately has targetValue 0) on each build.
if (addedTargetPeriod) {
  await client.execute(`
    UPDATE "goals"
    SET "targetPeriod" = 'DAILY'
    WHERE "goalType" = 'MERIT'
  `);
}

client.close();
console.log("patch-turso-schema: complete.");
