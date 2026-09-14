import { describe, expect, it } from "vitest";
import { applyPlatformMarkupCents, platformMarkupCents } from "./pricing";
import {
  contractorConnectStatusLabel,
  occupiedPayoutCents,
  remainingShopPayoutCents,
  shopEarningsCents,
  invoiceIsPayableForPayout,
  transferEligibility,
  transferEligibilityMessage,
  transferIdempotencyKey,
} from "./contractor-payouts";

const shopSubtotalCents = 36400;
const customerSubtotalCents = applyPlatformMarkupCents(shopSubtotalCents);
const markupCents = platformMarkupCents(shopSubtotalCents);

describe("shop earnings math", () => {
  it("pays the shop subtotal, never the customer total or 20% markup", () => {
    expect(shopEarningsCents({ subtotalCents: shopSubtotalCents })).toBe(36400);
    expect(customerSubtotalCents).toBe(43680);
    expect(markupCents).toBe(7280);
    expect(shopEarningsCents({ subtotalCents: shopSubtotalCents })).not.toBe(customerSubtotalCents);
    expect(shopEarningsCents({ subtotalCents: shopSubtotalCents })).not.toBe(markupCents);
  });

  it("ignores customer deposit cents when computing shop earnings", () => {
    const depositPaidCents = applyPlatformMarkupCents(18900);
    expect(depositPaidCents).toBe(22680);
    expect(shopEarningsCents({ subtotalCents: shopSubtotalCents })).toBe(36400);
    expect(remainingShopPayoutCents({ shopSubtotalCents, existingPayouts: [] })).toBe(36400);
  });

  it("is payable only after the TOD invoice is PAID", () => {
    expect(invoiceIsPayableForPayout({ status: "SENT", subtotalCents: shopSubtotalCents })).toBe(false);
    expect(invoiceIsPayableForPayout({ status: "DRAFT", subtotalCents: shopSubtotalCents })).toBe(false);
    expect(invoiceIsPayableForPayout({ status: "PAID", subtotalCents: shopSubtotalCents })).toBe(true);
    expect(invoiceIsPayableForPayout({ status: "PAID", subtotalCents: 0 })).toBe(false);
  });

  it("subtracts existing payout rows so retries cannot double-pay", () => {
    expect(
      remainingShopPayoutCents({
        shopSubtotalCents,
        existingPayouts: [{ shopAmountCents: 36400, status: "PENDING" }],
      }),
    ).toBe(0);
    expect(
      remainingShopPayoutCents({
        shopSubtotalCents,
        existingPayouts: [{ shopAmountCents: 36400, status: "PAID" }],
      }),
    ).toBe(0);
    expect(
      remainingShopPayoutCents({
        shopSubtotalCents,
        existingPayouts: [{ shopAmountCents: 36400, status: "FAILED" }],
      }),
    ).toBe(0);
    expect(occupiedPayoutCents([{ shopAmountCents: 100, status: "PENDING" }])).toBe(100);
  });
});

describe("transfer eligibility", () => {
  const ready = {
    payoutStatus: "PENDING",
    shopAmountCents: 36400,
    invoiceStatus: "PAID",
    contractorId: "pro_1",
    stripeConnectAccountId: "acct_connected",
    stripeConnectPayoutsEnabled: true,
  };

  it("allows a transfer when Connect is ready and the invoice is paid", () => {
    expect(transferEligibility(ready)).toEqual({ ok: true });
  });

  it("blocks unpaid invoices, missing Connect, and already-paid rows", () => {
    expect(transferEligibility({ ...ready, invoiceStatus: "SENT" })).toEqual({
      ok: false,
      code: "not_payable",
    });
    expect(transferEligibility({ ...ready, stripeConnectAccountId: null })).toEqual({
      ok: false,
      code: "needs_onboarding",
    });
    expect(transferEligibility({ ...ready, stripeConnectPayoutsEnabled: false })).toEqual({
      ok: false,
      code: "payouts_disabled",
    });
    expect(transferEligibility({ ...ready, payoutStatus: "PAID" })).toEqual({
      ok: false,
      code: "already_paid",
    });
    expect(transferEligibility({ ...ready, contractorId: null })).toEqual({
      ok: false,
      code: "unassigned",
    });
    expect(transferEligibilityMessage("needs_onboarding")).toMatch(/onboarding/i);
  });

  it("allows retrying a failed transfer when Connect is still ready", () => {
    expect(transferEligibility({ ...ready, payoutStatus: "FAILED" })).toEqual({ ok: true });
  });
});

describe("connect status + idempotency", () => {
  it("labels onboarding vs ready", () => {
    expect(
      contractorConnectStatusLabel({
        stripeConnectAccountId: null,
        stripeConnectOnboarded: false,
        stripeConnectPayoutsEnabled: false,
      }),
    ).toBe("needs_onboarding");
    expect(
      contractorConnectStatusLabel({
        stripeConnectAccountId: "acct_1",
        stripeConnectOnboarded: true,
        stripeConnectPayoutsEnabled: false,
      }),
    ).toBe("pending_review");
    expect(
      contractorConnectStatusLabel({
        stripeConnectAccountId: "acct_1",
        stripeConnectOnboarded: true,
        stripeConnectPayoutsEnabled: true,
      }),
    ).toBe("ready");
  });

  it("uses a stable idempotency key, then a retry key after a failed transfer id", () => {
    const updatedAt = new Date("2026-09-14T12:00:00.000Z");
    expect(transferIdempotencyKey({ id: "po_1", stripeTransferId: null, updatedAt })).toBe(
      "tod_payout_po_1",
    );
    expect(
      transferIdempotencyKey({ id: "po_1", stripeTransferId: "tr_failed", updatedAt }),
    ).toBe(`tod_payout_po_1_retry_${updatedAt.getTime()}`);
  });
});
