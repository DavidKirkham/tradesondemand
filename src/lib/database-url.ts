/** Used only so `prisma generate` / `next build` can run without a live database. */
export const PRISMA_GENERATE_PLACEHOLDER_URL =
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma";

const POSTGRES_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
] as const;

export function firstEnv(...keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function resolveDatabaseUrlFromEnv(): string | undefined {
  return firstEnv(...POSTGRES_ENV_KEYS);
}

export function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export function isPlaceholderDatabaseUrl(url: string): boolean {
  return url === PRISMA_GENERATE_PLACEHOLDER_URL || url.startsWith("postgresql://prisma:prisma@");
}

/** URL Prisma Client should use, or undefined if none is configured. */
export function getRuntimeDatabaseUrl(): string | undefined {
  const url = resolveDatabaseUrlFromEnv();
  if (!url || url.startsWith("file:")) return undefined;
  return url;
}

export function isNextProductionBuild(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

/** Live Postgres is required on Vercel/production request handlers, not during `next build`. */
export function shouldRequireLiveDatabase(): boolean {
  if (isNextProductionBuild()) return false;
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function assertProductionDatabaseUrl(): string {
  const url = getRuntimeDatabaseUrl();
  if (!url || isPlaceholderDatabaseUrl(url) || !isPostgresUrl(url)) {
    throw new Error(
      "DATABASE_URL is required at runtime. Set a PostgreSQL connection string (Neon, Vercel Postgres, or Supabase) on the Vercel project. Example: postgresql://USER:PASSWORD@HOST/tradesondemand?sslmode=require",
    );
  }
  return url;
}
