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
    return;
  }

  await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
  console.log(`patch-turso-schema: added ${table}.${name}.`);
}

await addColumn("goals", "direction", "TEXT NOT NULL DEFAULT 'GAIN'");
await addColumn("goals", "targetValue", "REAL NOT NULL DEFAULT 0");
await addColumn("goals", "currentValue", "REAL NOT NULL DEFAULT 0");
await addColumn("goals", "unit", "TEXT NOT NULL DEFAULT ''");
await addColumn("goal_tasks", "status", "TEXT NOT NULL DEFAULT 'NOT_STARTED'");

await client.execute(`
  UPDATE "goals"
  SET "targetValue" = 100,
      "currentValue" = "progress"
  WHERE "targetValue" = 0
`);

await client.execute(`
  UPDATE "goal_tasks"
  SET "status" = CASE
    WHEN "isComplete" THEN 'DONE'
    ELSE 'NOT_STARTED'
  END
  WHERE "status" = 'NOT_STARTED'
`);

client.close();
console.log("patch-turso-schema: complete.");
