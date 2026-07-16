/**
 * Loads environment the way the application does — and that distinction matters.
 *
 * `import "dotenv/config"` reads `.env` and nothing else, so anything kept in
 * `.env.local` — which is where credentials belong, since it is gitignored — is
 * invisible to it. The scripts would then die with "DATABASE_URL is not set"
 * against a project that runs perfectly well.
 *
 * `loadEnvConfig` is Next's own loader, the same one prisma.config.ts uses, so it
 * honours .env.local, .env.development.local and .env in Next's precedence.
 *
 * Import this FIRST, before anything that touches `db`: module evaluation follows
 * import order, and src/lib/db.ts reads DATABASE_URL the moment it loads.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
