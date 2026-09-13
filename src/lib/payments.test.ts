import { describe, expect, it } from "vitest";
import {
  contractorJobPaymentLabel,
  contractorJobPaymentStatus,
  sumContractorPayments,
} from "./contractor-payments";
import { depositForBooking } from "./payments";

describe("depositForBooking", () => {
  it("uses contractor emergency rate when urgent", () => {
    const result = depositForBooking({
      urgency: "emergency",
      trade: "plumbing",
      contractor: {
        hourlyRateCents: 9500,
        minimumChargeCents: 14900,
        emergencyRateCents: 17500,
        tradeRates: [{ slug: "plumbing", hourlyCents: 9500, minimumCents: 14900 }],
      },
    });
    expect(result.amountCents).toBe(17500);
    expect(result.summary).toMatch(/TOD/);
  });

  it("uses first-available emergency hold", () => {
    expect(depositForBooking({ urgency: "emergency", trade: "plumbing" }).amountCents).toBe(14900);
  });

  it("summarizes contractor-facing TOD payment status", () => {
    expect(contractorJobPaymentStatus([])).toBe("none");
    expect(contractorJobPaymentStatus([{ amountCents: 18900, status: "PENDING" }])).toBe("pending");
    expect(contractorJobPaymentStatus([{ amountCents: 18900, status: "PAID" }])).toBe("paid");
    expect(contractorJobPaymentStatus([{ amountCents: 14900, status: "REFUNDED" }])).toBe("refunded");
    expect(
      contractorJobPaymentStatus([
        { amountCents: 14900, status: "PAID" },
        { amountCents: 8000, status: "PENDING" },
      ]),
    ).toBe("partial");
    expect(contractorJobPaymentLabel("paid")).toMatch(/Paid to TOD/);
    expect(sumContractorPayments([{ amountCents: 100, status: "PAID" }, { amountCents: 40, status: "PENDING" }])).toEqual({
      paidCents: 100,
      pendingCents: 40,
      refundedCents: 0,
      count: 2,
    });
  });

  it("uses the selected contractor trip minimum for routine work", () => {
    const result = depositForBooking({
      urgency: "routine",
      trade: "hvac",
      contractor: {
        hourlyRateCents: 11000,
        minimumChargeCents: 18900,
        emergencyRateCents: 17500,
        tradeRates: [{ slug: "hvac", hourlyCents: 11000, minimumCents: 18900 }],
      },
    });
    expect(result.amountCents).toBe(18900);
    expect(result.summary).toMatch(/TOD trip minimum/);
  });
});
