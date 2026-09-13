import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const SCHEMA_MIGRATE_MESSAGE =
  "The production database is missing tables or columns this app expects (often Contractor.loginToken, Customer.passwordHash, or Invoice). Apply Prisma migrations: npm run db:migrate with DATABASE_URL and DATABASE_URL_UNPOOLED.";

export const DATABASE_URL_MESSAGE =
  "DATABASE_URL is not set on the server. Add a Neon PostgreSQL URL on Vercel, then run npm run db:migrate.";

export const DATABASE_CONNECT_MESSAGE =
  "Could not connect to the database. Check DATABASE_URL on Vercel and that Neon is reachable.";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isSchemaMismatchError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  const message = messageOf(error);
  return /loginToken|does not exist|column .* does not exist|relation .* does not exist/i.test(
    message,
  );
}

export function prismaFailureResponse(error: unknown, fallback: string) {
  if (error instanceof Error && /DATABASE_URL is required/.test(error.message)) {
    return jsonError(DATABASE_URL_MESSAGE, 500, { code: "DATABASE_URL_MISSING" });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return jsonError(SCHEMA_MIGRATE_MESSAGE, 500, { code: error.code });
    }
    if (error.code === "P2002") {
      return jsonError(
        "That application already exists. Call the KC desk if you need it updated.",
        409,
        { code: error.code },
      );
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return jsonError(DATABASE_CONNECT_MESSAGE, 500, { code: "DB_INIT" });
  }

  if (isSchemaMismatchError(error)) {
    return jsonError(SCHEMA_MIGRATE_MESSAGE, 500, { code: "SCHEMA_MISMATCH" });
  }

  return jsonError(fallback, 500);
}
