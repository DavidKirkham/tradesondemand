import { describe, expect, it } from "vitest";
import { serviceAreaLooksLikeMetro, validateContractorInput } from "./contractor";
import { parseUsdToCents } from "./money";

const base = {
  businessName: "Brookside Mechanical",
  contactName: "Sam Ortiz",
  phone: "8165160735",
  email: "sam@brookside.example",
  trades: ["plumbing", "hvac"],
  licenseNumber: "MO-PL-44219",
  licenseType: "Master plumber",
  licenseState: "MO",
  serviceArea: "Kansas City, Independence, and 64111",
  insured: true,
  insuranceDetails: "Acme Mutual 11-22",
  yearsExperience: "12",
  bio: "Family shop on the Missouri side.",
  hourlyRate: "95",
  minimumCharge: "149",
  emergencyRate: "175",
  tradeRates: [
    { slug: "plumbing", hourly: "95", minimum: "149" },
    { slug: "hvac", hourly: "110", minimum: "189" },
  ],
  agreedToTerms: true,
};

describe("contractor application", () => {
  it("accepts a licensed KC application with rates", () => {
    const result = validateContractorInput(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hourlyRateCents).toBe(9500);
      expect(result.data.minimumChargeCents).toBe(14900);
      expect(result.data.emergencyRateCents).toBe(17500);
      expect(result.data.tradeRates).toHaveLength(2);
      expect(result.data.licenseState).toBe("MO");
    }
  });

  it("rejects uninsured or out-of-metro coverage", () => {
    expect(validateContractorInput({ ...base, insured: false }).ok).toBe(false);
    expect(validateContractorInput({ ...base, serviceArea: "Wichita and Topeka" }).ok).toBe(false);
    expect(validateContractorInput({ ...base, agreedToTerms: false }).ok).toBe(false);
    expect(validateContractorInput({ ...base, trades: [] }).ok).toBe(false);
  });

  it("rejects non-positive currency", () => {
    expect(validateContractorInput({ ...base, hourlyRate: "0" }).ok).toBe(false);
    expect(validateContractorInput({ ...base, minimumCharge: "-20" }).ok).toBe(false);
    expect(validateContractorInput({ ...base, hourlyRate: "free" }).ok).toBe(false);
  });
});

describe("money + service area", () => {
  it("parses USD to cents", () => {
    expect(parseUsdToCents("$95.50")).toBe(9550);
    expect(parseUsdToCents("0")).toBeNull();
  });

  it("recognizes KC coverage text", () => {
    expect(serviceAreaLooksLikeMetro("Lee's Summit and Raytown")).toBe(true);
    expect(serviceAreaLooksLikeMetro("66210")).toBe(true);
    expect(serviceAreaLooksLikeMetro("Denver metro")).toBe(false);
  });
});
