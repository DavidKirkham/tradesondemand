import { describe, expect, it } from "vitest";
import { connectFlagsFromAccount, connectOnboardingUrls } from "./contractor-connect";
import { filterPayoutQueue, owedPayoutTotalCents, toAdminPayoutQueueRow } from "./admin-payouts";

describe("connectFlagsFromAccount", () => {
  it("reads v2 recipient stripe_transfers capability", () => {
    expect(
      connectFlagsFromAccount({
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: { stripe_transfers: { status: "active" } },
            },
          },
        },
      }),
    ).toEqual({ onboarded: true, payoutsEnabled: true });
  });

  it("reads v1 Express details_submitted / transfers", () => {
    expect(
      connectFlagsFromAccount({
        details_submitted: true,
        payouts_enabled: true,
        capabilities: { transfers: "active" },
      }),
    ).toEqual({ onboarded: true, payoutsEnabled: true });
    expect(
      connectFlagsFromAccount({
        details_submitted: false,
        payouts_enabled: false,
        capabilities: { transfers: "inactive" },
      }),
    ).toEqual({ onboarded: false, payoutsEnabled: false });
  });
});

describe("connectOnboardingUrls", () => {
  it("returns contractor payments return/refresh URLs", () => {
    expect(connectOnboardingUrls("https://todkc.com")).toEqual({
      refresh_url: "https://todkc.com/contractor/payments?connect=refresh",
      return_url: "https://todkc.com/contractor/payments?connect=return",
    });
  });
});

describe("admin payout queue", () => {
  const base = {
    id: "po_1",
    publicId: "XFR-ABC123",
    status: "PENDING",
    shopAmountCents: 36400,
    failureMessage: null,
    stripeTransferId: null,
    createdAt: new Date("2026-09-14T12:00:00Z"),
    transferredAt: null,
    booking: { id: "job_1", publicId: "TOD-DONE01" },
    invoice: {
      publicId: "INV-DONE01",
      status: "PAID",
      customerSubtotalCents: 43680,
      markupCents: 7280,
    },
    contractor: {
      id: "pro_1",
      businessName: "Waldo Heat & Pipe",
      stripeConnectAccountId: "acct_1",
      stripeConnectOnboarded: true,
      stripeConnectPayoutsEnabled: true,
    },
  };

  it("lets admin transfer shop earnings when Connect is ready", () => {
    const row = toAdminPayoutQueueRow(base);
    expect(row.canTransfer).toBe(true);
    expect(row.shopAmountCents).toBe(36400);
    expect(row.markupCents).toBe(7280);
    expect(owedPayoutTotalCents([row])).toBe(36400);
  });

  it("blocks transfer until Express onboarding is done", () => {
    const row = toAdminPayoutQueueRow({
      ...base,
      contractor: { ...base.contractor, stripeConnectAccountId: null, stripeConnectPayoutsEnabled: false },
    });
    expect(row.canTransfer).toBe(false);
    expect(row.transferBlockedReason).toBe("needs_onboarding");
  });

  it("filters by job, invoice, or shop name", () => {
    const rows = [toAdminPayoutQueueRow(base)];
    expect(filterPayoutQueue(rows, "waldo")).toHaveLength(1);
    expect(filterPayoutQueue(rows, "nope")).toHaveLength(0);
  });
});
