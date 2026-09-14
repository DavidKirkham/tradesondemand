import { describe, expect, it } from "vitest";
import { applyPlatformMarkupCents, FIRST_AVAILABLE_EMERGENCY_HOLD_CENTS } from "./pricing";
import { getQuotePreview } from "./quotes";

describe("getQuotePreview", () => {
  it("shows the marked-up first-available emergency hold to customers", () => {
    const quote = getQuotePreview("plumbing", "emergency");
    expect(quote.holdLabel).toBe("$106.80–$178.80 dispatch hold");
    expect(applyPlatformMarkupCents(FIRST_AVAILABLE_EMERGENCY_HOLD_CENTS)).toBe(17880);
  });

  it("does not invent a routine trip fee", () => {
    expect(getQuotePreview("hvac", "routine").holdLabel).toMatch(/No trip fee/i);
  });
});
