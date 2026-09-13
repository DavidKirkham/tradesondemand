#!/usr/bin/env node
/**
 * Normalize Neon / Vercel Postgres env vars for Prisma.
 * Schema reads DATABASE_URL (pooled) + DATABASE_URL_UNPOOLED (direct / migrate).
 * Neon may inject POSTGRES_PRISMA_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING instead.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

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
);

const direct = first(
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DIRECT_URL,
  process.env.POSTGRES_PRISMA_URL,
  pooled,
);

if (!pooled) {
  console.error(
    "Missing DATABASE_URL. Vercel/Neon injects this (or POSTGRES_PRISMA_URL). Locally use a postgresql:// URL from .env.example.",
  );
  process.exit(1);
}

if (pooled.startsWith("file:")) {
  console.error(
    "DATABASE_URL is a SQLite file: URL. This app requires PostgreSQL (postgresql:// or postgres://). Update Vercel/Neon or .env.",
  );
  process.exit(1);
}

process.env.DATABASE_URL = pooled;
process.env.DATABASE_URL_UNPOOLED = direct;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-db-env.cjs <prisma args>");
  process.exit(1);
}

const prismaBin = path.join(__dirname, "..", "node_modules", ".bin", "prisma");
const result = spawnSync(prismaBin, args, { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
