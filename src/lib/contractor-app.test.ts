import { describe, expect, it } from "vitest";
import {
  contractorLoginBlockReason,
  contractorStatusActionLabel,
  isContractorJobStatus,
  jobFitsContractor,
  validateContractorProfilePatch,
} from "./contractor-app";

describe("jobFitsContractor", () => {
  const waldo = {
    tradesJson: JSON.stringify(["plumbing", "hvac"]),
    serviceArea: "Kansas City, Brookside, Waldo, Independence",
  };

  it("matches assigned-area HVAC in Kansas City", () => {
    expect(jobFitsContractor({ trade: "hvac", city: "Kansas City", zip: "64114" }, waldo)).toBe(true);
  });

  it("rejects a trade they do not offer", () => {
    expect(jobFitsContractor({ trade: "roofing", city: "Kansas City", zip: "64114" }, waldo)).toBe(false);
  });
});

describe("contractorLoginBlockReason", () => {
  it("allows approved only", () => {
    expect(contractorLoginBlockReason("APPROVED")).toBeNull();
    expect(contractorLoginBlockReason("PENDING")).toMatch(/pending/i);
    expect(contractorLoginBlockReason("REJECTED")).toMatch(/not approved/i);
  });
});

describe("contractor job statuses", () => {
  it("allows en route / on site / done", () => {
    expect(isContractorJobStatus("EN_ROUTE")).toBe(true);
    expect(isContractorJobStatus("ON_SITE")).toBe(true);
    expect(isContractorJobStatus("COMPLETED")).toBe(true);
    expect(isContractorJobStatus("CANCELLED")).toBe(false);
    expect(contractorStatusActionLabel("COMPLETED")).toBe("Done");
  });
});

describe("validateContractorProfilePatch", () => {
  it("accepts public profile fields", () => {
    const result = validateContractorProfilePatch(
      {
        bio: "KC metro HVAC.",
        serviceArea: "Overland Park and 66204",
        hourlyRate: "120",
        minimumCharge: "189",
        emergencyRate: "220",
        yearsExperience: "10",
      },
      ["hvac"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hourlyRateCents).toBe(12000);
  });
});
