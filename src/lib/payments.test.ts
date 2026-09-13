import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contractorJobPaymentLabel,
  contractorJobPaymentStatus,
  sumContractorPayments,
} from "./contractor-payments";
import { depositForBooking } from "./payments";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("depositForBooking", () => {
  it("uses contractor emergency rate when urgent", () => {
    vi.stubEnv("SMOKE_DEPOSIT_CENTS", "");
    vi.stubEnv("NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS", "");
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
    expect(result.amountCents).toBe(21000);
    expect(result.summary).toMatch(/TOD/);
    expect(result.summary).toContain("$210.00");
  });

  it("uses first-available emergency hold", () => {
    vi.stubEnv("SMOKE_DEPOSIT_CENTS", "");
    vi.stubEnv("NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS", "");
    expect(depositForBooking({ urgency: "emergency", trade: "plumbing" }).amountCents).toBe(17880);
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

  it("uses SMOKE_DEPOSIT_CENTS when set to a positive integer", () => {
    vi.stubEnv("SMOKE_DEPOSIT_CENTS", "100");
    vi.stubEnv("NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS", "");
    const result = depositForBooking({ urgency: "emergency", trade: "plumbing" });
    expect(result.amountCents).toBe(100);
    expect(result.summary).toBe("TOD smoke deposit $1.00");
  });

  it("uses NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS when the server var is unset", () => {
    vi.stubEnv("SMOKE_DEPOSIT_CENTS", "");
    vi.stubEnv("NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS", "100");
    const result = depositForBooking({ urgency: "emergency", trade: "plumbing" });
    expect(result.amountCents).toBe(100);
    expect(result.summary).toBe("TOD smoke deposit $1.00");
  });

  it("prefers SMOKE_DEPOSIT_CENTS when both smoke vars are set", () => {
    vi.stubEnv("SMOKE_DEPOSIT_CENTS", "100");
    vi.stubEnv("NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS", "250");
    expect(depositForBooking({ urgency: "emergency", trade: "plumbing" }).amountCents).toBe(100);
  });

  it("uses the selected contractor trip minimum for routine work", () => {
    vi.stubEnv("SMOKE_DEPOSIT_CENTS", "");
    vi.stubEnv("NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS", "");
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
    expect(result.amountCents).toBe(22680);
    expect(result.summary).toMatch(/TOD trip minimum/);
    expect(result.summary).toContain("$226.80");
    expect(result.summary).toContain("$132.00/hr");
  });
});
