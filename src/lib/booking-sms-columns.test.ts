import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingBookingSmsColumn, withOptionalBookingSmsColumns } from "./booking-sms-columns";

function missingSmsColumn() {
  return new Prisma.PrismaClientKnownRequestError(
    "The column `Booking.customerSmsStatus` does not exist in the current database.",
    { code: "P2022", clientVersion: "6.19.3", meta: { column: "Booking.customerSmsStatus" } },
  );
}

describe("isMissingBookingSmsColumn", () => {
  it("matches Prisma P2022 on customerSms* columns", () => {
    expect(isMissingBookingSmsColumn(missingSmsColumn())).toBe(true);
    expect(
      isMissingBookingSmsColumn(
        new Prisma.PrismaClientKnownRequestError("The column `loginToken` does not exist", {
          code: "P2022",
          clientVersion: "6.19.3",
        }),
      ),
    ).toBe(false);
  });
});

describe("withOptionalBookingSmsColumns", () => {
  it("retries once with omitSms after a missing SMS column", async () => {
    const seen: boolean[] = [];
    const result = await withOptionalBookingSmsColumns(async (omitSms) => {
      seen.push(omitSms);
      if (!omitSms) throw missingSmsColumn();
      return "ok";
    });
    expect(result).toBe("ok");
    expect(seen).toEqual([false, true]);
  });
});
