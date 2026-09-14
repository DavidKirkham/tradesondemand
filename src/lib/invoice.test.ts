import { describe, expect, it } from "vitest";
import {
  contractorCanInvoiceJob,
  customerCanSeeInvoice,
  customerFacingInvoiceLines,
  customerFacingInvoiceTotals,
  depositCreditCents,
  invoiceIsLocked,
  invoicePaymentNote,
  invoiceStatusAfterSend,
  invoiceStatusLabel,
  laborCentsFromHours,
  linesToFormState,
  parseDiscountRow,
  parseHours,
  parseLaborRow,
  parseMaterialRow,
  persistableInvoiceMoney,
  preserveDiscountLines,
  totalsFromLines,
  validateInvoicePayload,
} from "./invoice";
import { applyPlatformMarkupCents } from "./pricing";

describe("parseHours", () => {
  it("accepts whole and quarter hours", () => {
    expect(parseHours("2")).toBe(2);
    expect(parseHours("1.5")).toBe(1.5);
    expect(parseHours("0.25")).toBe(0.25);
  });

  it("rejects empty, zero, and oversized values", () => {
    expect(parseHours("")).toBeNull();
    expect(parseHours("0")).toBeNull();
    expect(parseHours("201")).toBeNull();
    expect(parseHours("1.555")).toBeNull();
  });
});

describe("invoice totals", () => {
  it("credits paid deposits against marked-up customer totals", () => {
    expect(laborCentsFromHours(2.5, 11000)).toBe(27500);
    const depositPaidCents = applyPlatformMarkupCents(18900);
    const totals = totalsFromLines(
      [
        { kind: "LABOR", quantity: "2.5", unitCents: 11000, amountCents: 27500 },
        { kind: "MATERIAL", quantity: "1", unitCents: 8900, amountCents: 8900 },
      ],
      depositPaidCents,
    );
    expect(totals.laborCents).toBe(27500);
    expect(totals.materialsCents).toBe(8900);
    expect(totals.discountCents).toBe(0);
    expect(totals.subtotalCents).toBe(36400);
    expect(totals.customerSubtotalCents).toBe(43680);
    expect(totals.markupCents).toBe(7280);
    expect(totals.depositPaidCents).toBe(22680);
    expect(totals.amountDueCents).toBe(21000);
    expect(persistableInvoiceMoney(totals).amountDueCents).toBe(21000);
  });

  it("never shows a negative amount due when the deposit covers the job", () => {
    const totals = totalsFromLines(
      [{ kind: "LABOR", quantity: "1", unitCents: 11000, amountCents: 11000 }],
      18900,
    );
    expect(totals.amountDueCents).toBe(0);
    expect(invoiceStatusAfterSend(0)).toBe("PAID");
    expect(invoiceStatusAfterSend(100)).toBe("SENT");
  });

  it("applies a shop DISCOUNT line before the 20% markup", () => {
    const totals = totalsFromLines(
      [
        { kind: "LABOR", quantity: "2", unitCents: 11000, amountCents: 22000 },
        { kind: "MATERIAL", quantity: "1", unitCents: 16900, amountCents: 16900 },
        { kind: "DISCOUNT", quantity: "1", unitCents: -5000, amountCents: -5000 },
      ],
      18900,
    );
    expect(totals.laborCents).toBe(22000);
    expect(totals.materialsCents).toBe(16900);
    expect(totals.discountCents).toBe(-5000);
    expect(totals.subtotalCents).toBe(33900);
    expect(totals.customerSubtotalCents).toBe(applyPlatformMarkupCents(33900));
    expect(totals.customerSubtotalCents).toBe(40680);
    expect(totals.markupCents).toBe(6780);
    expect(totals.amountDueCents).toBe(21780);
  });

  it("credits only PAID rows and can exclude the invoice payment itself", () => {
    expect(
      depositCreditCents([
        { id: "dep", amountCents: 18900, status: "PAID" },
        { id: "pend", amountCents: 5000, status: "PENDING" },
        { id: "ref", amountCents: 2000, status: "REFUNDED" },
        { id: "bal", amountCents: 4000, status: "PAID" },
      ], "bal"),
    ).toBe(18900);
  });
});

describe("validateInvoicePayload", () => {
  it("builds labor and material lines", () => {
    const result = validateInvoicePayload({
      labor: [{ description: "HVAC labor", hours: "1.5", rate: "110" }],
      materials: [{ description: "Blower motor", cost: "89" }],
      note: "Replaced motor",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([
      {
        kind: "LABOR",
        description: "HVAC labor",
        quantity: "1.5",
        unitCents: 11000,
        amountCents: 16500,
      },
      {
        kind: "MATERIAL",
        description: "Blower motor",
        quantity: "1",
        unitCents: 8900,
        amountCents: 8900,
      },
    ]);
  });

  it("ignores empty rows and requires something billable", () => {
    expect(validateInvoicePayload({ labor: [{ hours: "", rate: "" }], materials: [{}] }).ok).toBe(
      false,
    );
    const skipped = validateInvoicePayload({
      labor: [{ hours: "", rate: "" }],
      materials: [{ description: "Parts", cost: "40" }],
    });
    expect(skipped.ok).toBe(true);
  });

  it("rejects a labor row with only hours or only a rate", () => {
    expect(parseLaborRow({ hours: "2", rate: "" }).ok).toBe(false);
    expect(parseMaterialRow({ description: "Filter" }).ok).toBe(false);
  });

  it("builds a shop discount line as a negative DISCOUNT amount", () => {
    expect(parseDiscountRow({}).ok).toBe(true);
    expect("skip" in parseDiscountRow({})).toBe(true);
    const parsed = parseDiscountRow({ description: "Goodwill", amount: "50" });
    expect(parsed).toEqual({
      ok: true,
      line: {
        kind: "DISCOUNT",
        description: "Goodwill",
        quantity: "1",
        unitCents: -5000,
        amountCents: -5000,
      },
    });
    const result = validateInvoicePayload({
      labor: [{ description: "HVAC labor", hours: "2", rate: "110" }],
      materials: [{ description: "Blower motor", cost: "169" }],
      discounts: [{ description: "Goodwill", amount: "50" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.filter((line) => line.kind === "DISCOUNT")).toEqual([
      {
        kind: "DISCOUNT",
        description: "Goodwill",
        quantity: "1",
        unitCents: -5000,
        amountCents: -5000,
      },
    ]);
  });

  it("rejects a discount larger than shop labor and materials", () => {
    const result = validateInvoicePayload({
      labor: [{ hours: "1", rate: "100" }],
      discounts: [{ amount: "200" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/cannot exceed the shop labor and materials/);
  });

  it("hydrates discount form rows and preserves admin discounts on contractor saves", () => {
    const lines = [
      {
        kind: "LABOR" as const,
        description: "Labor",
        quantity: "1",
        unitCents: 11000,
        amountCents: 11000,
      },
      {
        kind: "DISCOUNT" as const,
        description: "Goodwill",
        quantity: "1",
        unitCents: -2500,
        amountCents: -2500,
      },
    ];
    expect(linesToFormState(lines).discounts).toEqual([{ description: "Goodwill", amount: "25" }]);
    expect(
      preserveDiscountLines(
        [{ kind: "LABOR", description: "Labor", quantity: "2", unitCents: 11000, amountCents: 22000 }],
        lines,
      ),
    ).toEqual([
      { kind: "LABOR", description: "Labor", quantity: "2", unitCents: 11000, amountCents: 22000 },
      {
        kind: "DISCOUNT",
        description: "Goodwill",
        quantity: "1",
        unitCents: -2500,
        amountCents: -2500,
      },
    ]);
  });
});

describe("invoice visibility and copy", () => {
  it("hides drafts from customers and locks paid invoices", () => {
    expect(customerCanSeeInvoice("DRAFT")).toBe(false);
    expect(customerCanSeeInvoice("SENT")).toBe(true);
    expect(invoiceIsLocked("PAID")).toBe(true);
    expect(contractorCanInvoiceJob("COMPLETED")).toBe(true);
    expect(contractorCanInvoiceJob("CANCELLED")).toBe(false);
    expect(invoiceStatusLabel("SENT")).toMatch(/Sent/);
  });

  it("mentions TOD and the deposit credit on the payment note", () => {
    const note = invoicePaymentNote({
      publicId: "INV-ABC123",
      depositPaidCents: 22680,
      subtotalCents: 36400,
      customerSubtotalCents: 43680,
    });
    expect(note).toContain("INV-ABC123");
    expect(note).toContain("$226.80");
    expect(note).toContain("$436.80");
    expect(note).toMatch(/Trades on Demand/);
  });

  it("marks up customer-facing lines without changing contractor drafts", () => {
    const lines = [
      { kind: "LABOR" as const, quantity: "1.5", unitCents: 11000, amountCents: 16500 },
    ];
    expect(customerFacingInvoiceLines(lines, true)).toEqual([
      { kind: "LABOR", quantity: "1.5", unitCents: 13200, amountCents: 19800 },
    ]);
    expect(lines[0].amountCents).toBe(16500);
    expect(
      customerFacingInvoiceLines(
        [{ kind: "DISCOUNT" as const, quantity: "1", unitCents: -5000, amountCents: -5000 }],
        true,
      ),
    ).toEqual([{ kind: "DISCOUNT", quantity: "1", unitCents: -6000, amountCents: -6000 }]);
  });

  it("does not re-markup legacy invoices that never stored customer totals", () => {
    const display = customerFacingInvoiceTotals({
      laborCents: 16500,
      materialsCents: 19900,
      subtotalCents: 36400,
      customerSubtotalCents: 0,
      markupCents: 0,
      depositPaidCents: 18900,
      amountDueCents: 17500,
    });
    expect(display.subtotalCents).toBe(36400);
    expect(display.amountDueCents).toBe(17500);
    expect(display.markupCents).toBe(0);
  });
});
