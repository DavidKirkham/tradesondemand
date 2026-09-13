import { describe, expect, it } from "vitest";
import { validateAccountLookup, validateCustomerPatch } from "./customer";

describe("customer profile", () => {
  it("accepts a name, phone, and preferred contact patch", () => {
    const result = validateCustomerPatch({
      name: "Alex Morgan",
      phone: "(816) 555-0144",
      preferredContact: "EMAIL",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.phone).toBe("8165550144");
      expect(result.preferredContact).toBe("EMAIL");
    }
  });

  it("rejects invalid profile edits", () => {
    expect(validateCustomerPatch({ name: "A" }).ok).toBe(false);
    expect(validateCustomerPatch({ phone: "555" }).ok).toBe(false);
    expect(validateCustomerPatch({ preferredContact: "SMS" }).ok).toBe(false);
  });

  it("looks up a profile with booking email and phone", () => {
    const result = validateAccountLookup("Alex@Home.example", "816-555-0144");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe("alex@home.example");
      expect(result.phone).toBe("8165550144");
    }
  });
});
