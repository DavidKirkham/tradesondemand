import { describe, expect, it } from "vitest";
import { invoiceLockedReason, planBalancePayment } from "./invoice-persist";

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
