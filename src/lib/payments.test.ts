import { describe, expect, it } from "vitest";
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
});
