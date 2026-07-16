import { loadEnvConfig } from "@next/env";
import { config as loadDotenvFile } from "dotenv";
import { defineConfig } from "prisma/config";

if (process.env.DOTENV_CONFIG_PATH) {
  loadDotenvFile({ path: process.env.DOTENV_CONFIG_PATH, override: true });
} else {
  loadEnvConfig(process.cwd());
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
