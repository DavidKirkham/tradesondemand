import { describe, expect, it } from "vitest";
import {
  validateAdminBookingAddress,
  validateAdminContractorPatch,
  validateAdminCustomerPatch,
} from "./admin";

describe("validateAdminCustomerPatch", () => {
  it("accepts name, email, phone, and preferred contact", () => {
    const result = validateAdminCustomerPatch({
      name: "Alex Kim",
      email: "Alex@Example.com",
      phone: "(816) 555-0166",
      preferredContact: "EMAIL",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe("alex@example.com");
      expect(result.data.phone).toBe("8165550166");
      expect(result.data.preferredContact).toBe("EMAIL");
    }
  });

  it("rejects a bad email", () => {
    const result = validateAdminCustomerPatch({ email: "not-an-email" });
    expect(result.ok).toBe(false);
  });
});

describe("validateAdminContractorPatch", () => {
  const base = {
    businessName: "Waldo Heat",
    contactName: "Riley Chen",
    phone: "8165550100",
    email: "riley@waldo.example",
    trades: ["hvac"],
    licenseNumber: "KS-HV-100",
    licenseType: "HVAC contractor",
    licenseState: "KS",
    serviceArea: "Overland Park and 66204",
    insured: true,
    hourlyRate: "120",
    minimumCharge: "189",
    emergencyRate: "220",
    status: "APPROVED",
    reviewNote: "Licensed and insured.",
  };

  it("accepts a full profile edit without signup terms", () => {
    const result = validateAdminContractorPatch(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("APPROVED");
      expect(result.data.hourlyRateCents).toBe(12000);
      expect(result.data.reviewNote).toBe("Licensed and insured.");
    }
  });

  it("rejects an unknown status", () => {
    const result = validateAdminContractorPatch({ ...base, status: "HIRED" });
    expect(result.ok).toBe(false);
  });
});

describe("validateAdminBookingAddress", () => {
  it("accepts a KC metro address", () => {
    const result = validateAdminBookingAddress({
      street: "4800 Main St",
      city: "Kansas City",
      state: "MO",
      zip: "64112",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.zip).toBe("64112");
  });

  it("rejects a non-metro ZIP", () => {
    const result = validateAdminBookingAddress({
      street: "100 Main St",
      city: "St Louis",
      state: "MO",
      zip: "63101",
    });
    expect(result.ok).toBe(false);
  });
});
