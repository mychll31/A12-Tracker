import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

// Next.js re-evaluates modules on every HMR pass in dev; without a global cache
// each pass would instantiate another client and leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // The Vercel Turso integration injects TURSO_DATABASE_URL; local development
  // sets DATABASE_URL to a "file:" URL. Prefer the former so a deploy needs no
  // extra wiring, and fall back to the latter for the local file.
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'No database URL. Locally set DATABASE_URL to a SQLite file ("file:./dev.db"); on Vercel the Turso integration provides TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Set AUTH_SECRET too. See docs/LOCAL-SETUP.md.',
    );
  }

  if (process.env.VERCEL && !url.startsWith("libsql://")) {
    throw new Error(
      "Vercel deployments must use TURSO_DATABASE_URL/libsql. Refusing to use a local DATABASE_URL file.",
    );
  }

  // One adapter, two homes. Local development is a plain SQLite file; a
  // serverless deploy (Vercel) talks to a hosted libSQL/Turso database over the
  // network — a file on disk cannot survive an ephemeral filesystem. The auth
  // token is only needed for the remote case and is simply undefined locally.
  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
