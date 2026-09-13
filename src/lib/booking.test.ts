import { describe, expect, it } from "vitest";
import { validateBookingInput } from "./booking";

const base = {
  trade: "plumbing",
  problem: "Water heater leaking into the basement utility room.",
  urgency: "emergency",
  street: "4800 Main St",
  city: "Kansas City",
  state: "MO",
  zip: "64112",
  customerName: "Jordan Hale",
  customerPhone: "8165550199",
  customerEmail: "jordan@example.com",
};

describe("validateBookingInput", () => {
  it("accepts a complete KC emergency booking", () => {
    const result = validateBookingInput(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.zip).toBe("64112");
      expect(result.data.quoteSummary).toMatch(/dispatch hold/i);
      expect(result.data.quoteSummary).toContain("$178.80");
    }
  });

  it("rejects out-of-area jobs", () => {
    const result = validateBookingInput({ ...base, city: "Denver", state: "CO", zip: "80202" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Kansas City metro/i);
    }
  });

  it("rejects unknown trades", () => {
    const result = validateBookingInput({ ...base, trade: "farrier" });
    expect(result.ok).toBe(false);
  });

  it("requires a real problem description", () => {
    const result = validateBookingInput({ ...base, problem: "help" });
    expect(result.ok).toBe(false);
  });
});
