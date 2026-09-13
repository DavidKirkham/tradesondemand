import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  DATABASE_URL_MESSAGE,
  SCHEMA_MIGRATE_MESSAGE,
  isSchemaMismatchError,
  prismaFailureResponse,
} from "./api-errors";

async function read(response: Response) {
  return {
    status: response.status,
    body: (await response.json()) as { error?: string; code?: string },
  };
}

describe("prismaFailureResponse", () => {
  it("returns JSON 500 when Contractor.loginToken / schema is missing", async () => {
    const missingColumn = new Prisma.PrismaClientKnownRequestError(
      "The column `loginToken` does not exist in the current database.",
      { code: "P2022", clientVersion: "6.19.3", meta: { column: "Contractor.loginToken" } },
    );
    const { status, body } = await read(prismaFailureResponse(missingColumn, "fallback"));
    expect(status).toBe(500);
    expect(body.error).toBe(SCHEMA_MIGRATE_MESSAGE);
    expect(body.code).toBe("P2022");
    expect(isSchemaMismatchError(missingColumn)).toBe(true);
  });

  it("returns JSON 500 when the Contractor table is missing", async () => {
    const missingTable = new Prisma.PrismaClientKnownRequestError("Table does not exist", {
      code: "P2021",
      clientVersion: "6.19.3",
    });
    const { status, body } = await read(prismaFailureResponse(missingTable, "fallback"));
    expect(status).toBe(500);
    expect(body.code).toBe("P2021");
    expect(body.error).toContain("npm run db:migrate");
  });

  it("returns JSON 500 when DATABASE_URL is unset", async () => {
    const { status, body } = await read(
      prismaFailureResponse(new Error("DATABASE_URL is required at runtime."), "fallback"),
    );
    expect(status).toBe(500);
    expect(body.error).toBe(DATABASE_URL_MESSAGE);
    expect(body.code).toBe("DATABASE_URL_MISSING");
  });

  it("does not leak unknown errors; still returns JSON", async () => {
    const { status, body } = await read(prismaFailureResponse(new Error("boom"), "Could not save."));
    expect(status).toBe(500);
    expect(body.error).toBe("Could not save.");
    expect(body).not.toHaveProperty("code");
  });
});
