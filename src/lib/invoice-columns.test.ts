import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isMissingInvoiceMarkupColumn, isMissingInvoiceModel } from "./invoice-columns";

describe("isMissingInvoiceModel", () => {
  it("matches a missing Invoice table", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "The table `public.Invoice` does not exist in the current database.",
      { code: "P2021", clientVersion: "6.19.3", meta: { table: "public.Invoice" } },
    );
    expect(isMissingInvoiceModel(error)).toBe(true);
  });

  it("ignores unrelated schema gaps", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "The column `Booking.customerSmsStatus` does not exist in the current database.",
      { code: "P2022", clientVersion: "6.19.3", meta: { column: "Booking.customerSmsStatus" } },
    );
    expect(isMissingInvoiceModel(error)).toBe(false);
  });

  it("matches missing invoice markup columns", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "The column `Invoice.customerSubtotalCents` does not exist in the current database.",
      { code: "P2022", clientVersion: "6.19.3", meta: { column: "Invoice.customerSubtotalCents" } },
    );
    expect(isMissingInvoiceMarkupColumn(error)).toBe(true);
    expect(isMissingInvoiceMarkupColumn(
      new Prisma.PrismaClientKnownRequestError(
        "The column `Booking.customerSmsStatus` does not exist in the current database.",
        { code: "P2022", clientVersion: "6.19.3", meta: { column: "Booking.customerSmsStatus" } },
      ),
    )).toBe(false);
  });
});
