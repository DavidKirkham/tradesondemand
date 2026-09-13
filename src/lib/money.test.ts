import { describe, expect, it } from "vitest";
import { formatUsd, parseUsdToCents } from "./money";

describe("formatUsd", () => {
  it("formats cents", () => {
    expect(formatUsd(14900)).toBe("$149.00");
  });
});

describe("parseUsdToCents", () => {
  it("accepts common dollar strings", () => {
    expect(parseUsdToCents("89")).toBe(8900);
    expect(parseUsdToCents("89.5")).toBe(8950);
  });
});
