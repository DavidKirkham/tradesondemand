import { describe, expect, it } from "vitest";
import {
  applyPlatformMarkupCents,
  formatCustomerUsd,
  formatShopAndCustomerUsd,
  markupCustomerCents,
  PLATFORM_MARKUP_BPS,
  platformMarkupCents,
} from "./pricing";

describe("applyPlatformMarkupCents", () => {
  it("is a single 20% constant", () => {
    expect(PLATFORM_MARKUP_BPS).toBe(2000);
  });

  it("marks up exact dollars without float drift", () => {
    expect(applyPlatformMarkupCents(10000)).toBe(12000);
    expect(applyPlatformMarkupCents(14900)).toBe(17880);
    expect(applyPlatformMarkupCents(17500)).toBe(21000);
    expect(applyPlatformMarkupCents(18900)).toBe(22680);
    expect(applyPlatformMarkupCents(36400)).toBe(43680);
  });

  it("uses integer half-up rounding", () => {
    expect(applyPlatformMarkupCents(1)).toBe(1);
    expect(applyPlatformMarkupCents(3)).toBe(4);
    expect(applyPlatformMarkupCents(5)).toBe(6);
  });

  it("does not mark up zero or invalid cents", () => {
    expect(applyPlatformMarkupCents(0)).toBe(0);
    expect(applyPlatformMarkupCents(-100)).toBe(0);
    expect(applyPlatformMarkupCents(Number.NaN)).toBe(0);
  });

  it("shares one implementation across aliases", () => {
    expect(markupCustomerCents(11000)).toBe(13200);
    expect(platformMarkupCents(11000)).toBe(2200);
    expect(formatCustomerUsd(11000)).toBe("$132.00");
    expect(formatShopAndCustomerUsd(11000)).toBe("$110.00 shop · $132.00 customer");
  });
});
