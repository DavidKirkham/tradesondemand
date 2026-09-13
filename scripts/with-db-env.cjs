#!/usr/bin/env node
/**
 * Prisma schema is PostgreSQL only (Neon / Vercel Postgres).
 * Always set DATABASE_URL + DATABASE_URL_UNPOOLED before prisma CLI.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const PLACEHOLDER = "postgresql://prisma:prisma@127.0.0.1:5432/prisma";

function first(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

const pooled = first(
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DIRECT_URL,
);

const direct = first(
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DIRECT_URL,
  pooled,
);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-db-env.cjs <prisma args>");
  process.exit(1);
}

const isGenerate = args[0] === "generate";
const isMigrate = args[0] === "migrate";

if (pooled && pooled.startsWith("file:")) {
  console.error(
    "DATABASE_URL is a SQLite file: URL. schema.prisma provider is postgresql. Set a postgresql:// Neon/Vercel/Supabase URL.",
  );
  process.exit(1);
}

if (!pooled && isGenerate) {
  process.env.DATABASE_URL = PLACEHOLDER;
  process.env.DATABASE_URL_UNPOOLED = PLACEHOLDER;
  console.warn("DATABASE_URL unset — generating Prisma client with a placeholder Postgres URL (no live connection).");
} else if (!pooled && isMigrate) {
  console.warn("Skipping prisma migrate — DATABASE_URL is not set. Run `npm run db:migrate` after Neon is configured.");
  process.exit(0);
} else if (!pooled) {
  console.error("Missing DATABASE_URL. Neon/Vercel injects DATABASE_URL or POSTGRES_PRISMA_URL.");
  process.exit(1);
} else {
  process.env.DATABASE_URL = pooled;
  process.env.DATABASE_URL_UNPOOLED = direct;
}

const prismaBin = path.join(__dirname, "..", "node_modules", ".bin", "prisma");
const result = spawnSync(prismaBin, args, { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
