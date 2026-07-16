/**
 * READ-ONLY production inspector. Does not write, update, or delete anything —
 * only SELECT count(*) and PRAGMA table_info. Use it to see what is actually in
 * the database Production reads.
 *
 * Run:
 *   vercel env pull .env.prodcheck
 *   node -r dotenv/config scripts/inspect-turso.mjs dotenv_config_path=.env.prodcheck
 *
 * (or pass the creds inline)
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" node scripts/inspect-turso.mjs
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("No TURSO_DATABASE_URL / DATABASE_URL in env.");
  process.exit(1);
}

const client = createClient({ url, authToken });
console.log("Database:", url.replace(/\?.*/, ""));

const tables = [
  "organizations",
  "users",
  "user_roles",
  "goals",
  "goal_tasks",
  "merit_logs",
  "core_task_completions",
  "daily_check_ins",
];

console.log("\n-- row counts --");
for (const t of tables) {
  try {
    const r = await client.execute(`SELECT count(*) AS n FROM "${t}"`);
    console.log(`  ${t.padEnd(24)} ${r.rows[0].n}`);
  } catch (e) {
    console.log(`  ${t.padEnd(24)} (missing table: ${e.message})`);
  }
}

console.log("\n-- users --");
try {
  const r = await client.execute(`SELECT email FROM "users" ORDER BY email`);
  for (const row of r.rows) console.log(`  ${row.email}`);
} catch (e) {
  console.log(`  (error: ${e.message})`);
}

console.log("\n-- goals columns (do goalType / targetPeriod exist?) --");
try {
  const r = await client.execute(`PRAGMA table_info("goals")`);
  console.log("  " + r.rows.map((row) => row.name).join(", "));
} catch (e) {
  console.log(`  (error: ${e.message})`);
}

client.close();
