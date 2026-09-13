import { describe, expect, it } from "vitest";
import {
  contractorLoginBlockReason,
  contractorStatusActionLabel,
  isContractorJobStatus,
  isOpenContractorJob,
  isPastContractorJob,
  jobFitsContractor,
  validateContractorCustomerMessage,
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

  it("matches a ZIP listed in the service area", () => {
    expect(
      jobFitsContractor(
        { trade: "plumbing", city: "Olathe", zip: "66061" },
        { tradesJson: JSON.stringify(["plumbing"]), serviceArea: "Johnson County 66061" },
      ),
    ).toBe(true);
  });

  it("does not treat every metro city as in-area unless they wrote metro", () => {
    const olathe = {
      tradesJson: JSON.stringify(["plumbing"]),
      serviceArea: "Olathe and 66061",
    };
    expect(jobFitsContractor({ trade: "plumbing", city: "Independence", zip: "64050" }, olathe)).toBe(false);
    expect(
      jobFitsContractor(
        { trade: "plumbing", city: "Independence", zip: "64050" },
        { tradesJson: JSON.stringify(["plumbing"]), serviceArea: "Kansas City metro" },
      ),
    ).toBe(true);
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

  it("validates business contact when sent", () => {
    const bad = validateContractorProfilePatch(
      {
        serviceArea: "Overland Park and 66204",
        hourlyRate: "120",
        minimumCharge: "189",
        contactName: "M",
        phone: "8165160735",
        email: "morgan@waldoheat.example",
      },
      ["hvac"],
    );
    expect(bad.ok).toBe(false);

    const ok = validateContractorProfilePatch(
      {
        serviceArea: "Overland Park and 66204",
        hourlyRate: "120",
        minimumCharge: "189",
        contactName: "Morgan Ellis",
        phone: "(816) 516-0735",
        email: "Morgan@WaldoHeat.example",
      },
      ["hvac"],
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.contact?.phone).toBe("8165160735");
      expect(ok.data.contact?.email).toBe("morgan@waldoheat.example");
    }
  });
});

describe("past vs current jobs", () => {
  it("treats completed and cancelled as past", () => {
    expect(isPastContractorJob("COMPLETED")).toBe(true);
    expect(isPastContractorJob("CANCELLED")).toBe(true);
    expect(isOpenContractorJob("DISPATCHED")).toBe(true);
    expect(isOpenContractorJob("EN_ROUTE")).toBe(true);
    expect(isOpenContractorJob("COMPLETED")).toBe(false);
  });
});

describe("validateContractorCustomerMessage", () => {
  it("requires 8–240 characters", () => {
    expect(validateContractorCustomerMessage("short").ok).toBe(false);
    expect(validateContractorCustomerMessage("I can be there in 45 minutes.").ok).toBe(true);
    expect(validateContractorCustomerMessage("x".repeat(241)).ok).toBe(false);
  });
});
