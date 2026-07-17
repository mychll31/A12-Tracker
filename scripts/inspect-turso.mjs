/**
 * READ-ONLY production inspector. Never writes, updates or deletes — only
 * SELECT count(*) and PRAGMA table_info.
 *
 * It resolves the database URL exactly the way src/lib/db.ts does
 * (DATABASE_URL first, TURSO_DATABASE_URL only as a fallback) so it reports the
 * database the deployed app would actually talk to — and warns when that URL is
 * a per-deployment one from the Vercel Turso integration (`dpl-…turso.io`),
 * which is the classic "my data vanishes on every deploy" cause.
 *
 * Run:
 *   vercel env pull .env.prodcheck
 *   node -r dotenv/config scripts/inspect-turso.mjs dotenv_config_path=.env.prodcheck
 */
import { createClient } from "@libsql/client";

const mask = (u) =>
  !u ? "(unset)" : u.replace(/^(libsql:\/\/[^.]{0,14})[^.]*/, "$1…");

const dbUrl = process.env.DATABASE_URL;
const tursoUrl = process.env.TURSO_DATABASE_URL;

// Same precedence as src/lib/db.ts.
const url = dbUrl || tursoUrl;
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

console.log("-- env as the app resolves it --");
console.log("  DATABASE_URL        :", mask(dbUrl));
console.log("  TURSO_DATABASE_URL  :", mask(tursoUrl));
console.log("  auth token present  :", Boolean(authToken));
console.log("  => app would use    :", dbUrl ? "DATABASE_URL" : "TURSO_DATABASE_URL");

if (!url) {
  console.error("\nNo database URL in env.");
  console.error(
    "If this came from `vercel env pull`, the pulled file contains empty values.",
  );
  console.error(
    "Add real stable Turso credentials as DATABASE_URL and DATABASE_AUTH_TOKEN",
  );
  console.error(
    "in Vercel Production, then pull again or paste them into this check file.",
  );
  process.exit(1);
}

if (/dpl-/.test(url)) {
  console.log(
    "\n  *** WARNING: this URL is DEPLOYMENT-SCOPED (contains 'dpl-').",
  );
  console.log(
    "      Every new deployment gets a fresh database at a new dpl- URL,",
  );
  console.log(
    "      so data written by the previous deployment is not visible here.",
  );
  console.log(
    "      Fix: set DATABASE_URL to your one stable libsql:// Turso URL.",
  );
}

const client = createClient({ url, authToken });

const tables = [
  "organizations",
  "roles",
  "users",
  "user_roles",
  // Reference data the app cannot function without: no categories means every
  // createGoal() throws; no core_tasks means an empty daily board.
  "goal_categories",
  "core_tasks",
  "achievements",
  "coach_groups",
  "group_memberships",
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
