import { PrismaClient } from "@prisma/client";
import {
  assertProductionDatabaseUrl,
  getRuntimeDatabaseUrl,
  PRISMA_GENERATE_PLACEHOLDER_URL,
  shouldRequireLiveDatabase,
} from "./database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const url = shouldRequireLiveDatabase()
    ? assertProductionDatabaseUrl()
    : (getRuntimeDatabaseUrl() ?? PRISMA_GENERATE_PLACEHOLDER_URL);

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url } },
  });
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Lazy so importing this module during `next build` does not require DATABASE_URL.
 * Production request handlers still throw if the URL is missing.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
