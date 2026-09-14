import { describe, expect, it } from "vitest";
import { invoiceLockedReason, persistInvoiceEdits, planBalancePayment, resolveBalancePayment } from "./invoice-persist";
import type { PersistInvoiceInput } from "./invoice-persist";
import { applyPlatformMarkupCents } from "./pricing";

const pending = { id: "pay_bal", status: "PENDING", amountCents: 21000 };

describe("invoiceLockedReason", () => {
  it("locks paid invoices and paid balance payments", () => {
    expect(invoiceLockedReason(null)).toBeNull();
    expect(invoiceLockedReason({ status: "SENT", payment: pending })).toBeNull();
    expect(invoiceLockedReason({ status: "PAID", payment: pending })).toBe(
      "This invoice is already paid to TOD.",
    );
    expect(invoiceLockedReason({ status: "SENT", payment: { ...pending, status: "PAID" } })).toBe(
      "This invoice is already paid to TOD.",
    );
    expect(
      invoiceLockedReason({
        status: "SENT",
        payment: { id: "pay_dep", status: "PAID", amountCents: 22680, type: "DEPOSIT" },
      }),
    ).toBeNull();
  });
});

describe("planBalancePayment", () => {
  const base = {
    publicId: "INV-DONE01",
    depositPaidCents: 22680,
    subtotalCents: 36400,
    customerSubtotalCents: 43680,
  };

  it("does not touch payments while the invoice stays a draft", () => {
    expect(
      planBalancePayment({
        ...base,
        publish: false,
        amountDueCents: 21000,
        existingPayment: pending,
      }),
    ).toEqual({ kind: "none" });
  });

  it("updates a pending balance and clears Stripe when the customer amount changes", () => {
    const plan = planBalancePayment({
      ...base,
      publish: true,
      amountDueCents: 24000,
      existingPayment: pending,
    });
    expect(plan).toMatchObject({
      kind: "update",
      paymentId: "pay_bal",
      amountCents: 24000,
      clearStripe: true,
    });
    if (plan.kind === "update") {
      expect(plan.note).toContain("$436.80");
      expect(plan.note).not.toContain("$364.00");
    }
  });

  it("keeps the Checkout session when the marked-up amount due is unchanged", () => {
    expect(
      planBalancePayment({
        ...base,
        publish: true,
        amountDueCents: 21000,
        existingPayment: pending,
      }),
    ).toMatchObject({
      kind: "update",
      clearStripe: false,
    });
  });

  it("creates a pending balance at the customer amount, not the shop subtotal", () => {
    expect(
      planBalancePayment({
        ...base,
        publish: true,
        amountDueCents: 21000,
        existingPayment: null,
      }),
    ).toMatchObject({ kind: "create", amountCents: 21000 });
  });

  it("deletes a pending balance when the deposit covers the invoice", () => {
    expect(
      planBalancePayment({
        ...base,
        publish: true,
        amountDueCents: 0,
        existingPayment: pending,
      }),
    ).toEqual({ kind: "delete", paymentId: "pay_bal" });
  });
});

describe("resolveBalancePayment", () => {
  const deposit = { id: "pay_dep", status: "PAID", amountCents: 22680, type: "DEPOSIT" };
  const balance = { id: "pay_bal", status: "PENDING", amountCents: 21000, type: "BALANCE" };

  it("keeps the linked pending balance", () => {
    expect(resolveBalancePayment({ linked: balance, bookingPayments: [deposit, balance] })).toEqual(balance);
  });

  it("finds a booking BALANCE when the invoice is linked to a paid deposit", () => {
    expect(resolveBalancePayment({ linked: deposit, bookingPayments: [deposit, balance] })).toEqual(balance);
  });

  it("returns null when nothing is pending", () => {
    expect(resolveBalancePayment({ linked: deposit, bookingPayments: [deposit] })).toBeNull();
  });
});

describe("persistInvoiceEdits", () => {
  const lines: PersistInvoiceInput["lines"] = [
    { kind: "LABOR", description: "HVAC labor", quantity: "2", unitCents: 11000, amountCents: 22000 },
    { kind: "MATERIAL", description: "Blower motor", quantity: "1", unitCents: 16900, amountCents: 16900 },
    { kind: "DISCOUNT", description: "Goodwill", quantity: "1", unitCents: -5000, amountCents: -5000 },
  ];
  const shopSubtotalCents = 22000 + 16900 - 5000;
  const customerSubtotalCents = applyPlatformMarkupCents(shopSubtotalCents);
  const amountDueCents = customerSubtotalCents - 22680;

  function createTx() {
    const storedLines: unknown[] = [];
    const payment = {
      id: "pay_bal",
      status: "PENDING",
      amountCents: 21000,
      type: "BALANCE",
      stripeCheckoutSessionId: "cs_old",
    };
    const invoice = {
      id: "inv_1",
      publicId: "INV-DONE01",
      bookingId: "job_1",
      paymentId: "pay_bal",
    };
    return {
      invoice: {
        update: async ({ data, include }: { data: Record<string, unknown>; include?: unknown }) => {
          Object.assign(invoice, data);
          if (include) {
            return { ...invoice, lines: [...storedLines], payment: { ...payment } };
          }
          return { ...invoice };
        },
      },
      invoiceLine: {
        deleteMany: async () => {
          storedLines.length = 0;
          return { count: 2 };
        },
        createMany: async ({ data }: { data: unknown[] }) => {
          storedLines.push(...data);
          return { count: data.length };
        },
      },
      payment: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(payment, data);
          return { ...payment };
        },
        create: async () => {
          throw new Error("should update the existing BALANCE");
        },
        delete: async () => {
          throw new Error("should not delete");
        },
      },
    };
  }

  it("replaces lines, writes marked-up due, updates BALANCE, and clears Checkout", async () => {
    const tx = createTx();
    const saved = await persistInvoiceEdits(tx as never, {
      booking: { id: "job_1", customerId: "cus_1" },
      existing: {
        id: "inv_1",
        publicId: "INV-DONE01",
        paymentId: "pay_dep",
        sentAt: new Date("2026-09-01T12:00:00Z"),
        paidAt: null,
        status: "SENT",
        payment: { id: "pay_dep", status: "PAID", amountCents: 22680, type: "DEPOSIT" },
      },
      contractorId: "pro_1",
      lines,
      totals: {
        laborHours: "2",
        laborRateCents: 11000,
        laborCents: 22000,
        materialsCents: 16900,
        discountCents: -5000,
        subtotalCents: shopSubtotalCents,
        customerSubtotalCents,
        markupCents: customerSubtotalCents - shopSubtotalCents,
        depositPaidCents: 22680,
        amountDueCents,
      },
      note: "Admin correction",
      publish: true,
      bookingPayments: [
        { id: "pay_dep", status: "PAID", amountCents: 22680, type: "DEPOSIT" },
        { id: "pay_bal", status: "PENDING", amountCents: 21000, type: "BALANCE", stripeCheckoutSessionId: "cs_old" },
      ],
    });

    expect(amountDueCents).toBe(18000);
    expect(saved.amountDueCents).toBe(amountDueCents);
    expect(saved.customerSubtotalCents).toBe(customerSubtotalCents);
    expect(saved.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "DISCOUNT", amountCents: -5000 }),
        expect.objectContaining({ kind: "LABOR", amountCents: 22000 }),
      ]),
    );
    expect(saved.payment).toMatchObject({
      id: "pay_bal",
      amountCents: amountDueCents,
      stripeCheckoutSessionId: null,
    });
  });
});
