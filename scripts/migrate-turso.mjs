/**
 * Applies the Prisma migration SQL to a Turso (libSQL) database.
 *
 * Prisma Migrate's engine does not speak the `libsql://` protocol, so the
 * serverless build never migrates the remote database. Instead you run this once
 * (and again whenever a new migration is added) from your own machine:
 *
 *   DATABASE_URL="libsql://<db>.turso.io" \
 *   TURSO_AUTH_TOKEN="<token>" \
 *   npm run db:turso
 *
 * Then seed it the normal way (the app's Prisma client talks to Turso too):
 *
 *   DATABASE_URL="libsql://<db>.turso.io" TURSO_AUTH_TOKEN="<token>" npm run db:seed
 *
 * The statements are plain SQLite DDL (CREATE TABLE / INDEX), so this is meant
 * for a fresh database — re-running it on a populated one will error on the
 * tables that already exist, which is the safe way to notice you did.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error(
    'Set TURSO_DATABASE_URL (or DATABASE_URL) to your Turso URL ("libsql://…") and TURSO_AUTH_TOKEN before running this.',
  );
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const dirs = fs
  .readdirSync(migrationsDir)
  .filter((name) =>
    fs.existsSync(path.join(migrationsDir, name, "migration.sql")),
  )
  .sort();

if (dirs.length === 0) {
  console.error("No migrations found under prisma/migrations.");
  process.exit(1);
}

const client = createClient({ url, authToken });

for (const name of dirs) {
  const sql = fs.readFileSync(
    path.join(migrationsDir, name, "migration.sql"),
    "utf8",
  );
  process.stdout.write(`applying ${name} … `);
  await client.executeMultiple(sql);
  console.log("ok");
}

console.log(`\nApplied ${dirs.length} migration(s) to Turso. Now seed it:`);
console.log('  DATABASE_URL="' + url + '" TURSO_AUTH_TOKEN="…" npm run db:seed');
client.close();
