import { afterEach, describe, expect, it } from "vitest";
import {
  assertProductionDatabaseUrl,
  getRuntimeDatabaseUrl,
  isPlaceholderDatabaseUrl,
  isPostgresUrl,
  isNextProductionBuild,
  PRISMA_GENERATE_PLACEHOLDER_URL,
  resolveDatabaseUrlFromEnv,
  shouldRequireLiveDatabase,
} from "./database-url";

const KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
];

const snapshot = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clearDbEnv() {
  for (const key of KEYS) delete process.env[key];
}

describe("resolveDatabaseUrlFromEnv", () => {
  it("prefers DATABASE_URL over Neon aliases", () => {
    clearDbEnv();
    process.env.POSTGRES_URL = "postgresql://neon/alias";
    process.env.DATABASE_URL = "postgresql://primary/db";
    expect(resolveDatabaseUrlFromEnv()).toBe("postgresql://primary/db");
  });

  it("falls back to POSTGRES_PRISMA_URL / POSTGRES_URL", () => {
    clearDbEnv();
    process.env.POSTGRES_PRISMA_URL = "postgresql://neon/prisma";
    expect(resolveDatabaseUrlFromEnv()).toBe("postgresql://neon/prisma");
  });
});

describe("getRuntimeDatabaseUrl", () => {
  it("rejects SQLite file URLs", () => {
    clearDbEnv();
    process.env.DATABASE_URL = "file:./dev.db";
    expect(getRuntimeDatabaseUrl()).toBeUndefined();
  });
});

describe("assertProductionDatabaseUrl", () => {
  it("rejects missing, placeholder, and non-postgres URLs", () => {
    clearDbEnv();
    expect(() => assertProductionDatabaseUrl()).toThrow(/DATABASE_URL is required at runtime/);

    process.env.DATABASE_URL = PRISMA_GENERATE_PLACEHOLDER_URL;
    expect(() => assertProductionDatabaseUrl()).toThrow(/DATABASE_URL is required at runtime/);
  });

  it("accepts a real postgres URL", () => {
    clearDbEnv();
    process.env.DATABASE_URL = "postgresql://user:pass@ep-example.neon.tech/neondb?sslmode=require";
    expect(assertProductionDatabaseUrl()).toContain("neon.tech");
  });
});

describe("url helpers", () => {
  it("detects postgres and placeholder URLs", () => {
    expect(isPostgresUrl("postgres://localhost/db")).toBe(true);
    expect(isPlaceholderDatabaseUrl(PRISMA_GENERATE_PLACEHOLDER_URL)).toBe(true);
  });
});

describe("shouldRequireLiveDatabase", () => {
  it("is false during next build", () => {
    const phase = process.env.NEXT_PHASE;
    const lifecycle = process.env.npm_lifecycle_event;
    process.env.NEXT_PHASE = "phase-production-build";
    expect(isNextProductionBuild()).toBe(true);
    expect(shouldRequireLiveDatabase()).toBe(false);
    if (phase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = phase;
    if (lifecycle === undefined) delete process.env.npm_lifecycle_event;
    else process.env.npm_lifecycle_event = lifecycle;
  });
});
