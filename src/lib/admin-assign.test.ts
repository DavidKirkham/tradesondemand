import { describe, expect, it } from "vitest";
import {
  adminAssignEventNote,
  filterApprovedContractorsForTrade,
  jobIsAssignable,
  nextStatusOnAdminAssign,
} from "./admin-assign";

const shops = [
  { id: "a", businessName: "Waldo Heat & Pipe", publicId: "PRO-1", trades: ["plumbing", "hvac"] },
  { id: "b", businessName: "Brookside Paint", publicId: "PRO-2", trades: ["painting"] },
];

describe("nextStatusOnAdminAssign", () => {
  it("dispatches a received ticket and keeps later statuses", () => {
    expect(nextStatusOnAdminAssign("RECEIVED")).toBe("DISPATCHED");
    expect(nextStatusOnAdminAssign("DISPATCHED")).toBe("DISPATCHED");
    expect(nextStatusOnAdminAssign("EN_ROUTE")).toBe("EN_ROUTE");
    expect(nextStatusOnAdminAssign("ON_SITE")).toBe("ON_SITE");
    expect(nextStatusOnAdminAssign("COMPLETED")).toBe("COMPLETED");
    expect(nextStatusOnAdminAssign("CANCELLED")).toBeNull();
  });
});

describe("adminAssignEventNote", () => {
  it("names the shop and records a reassignment", () => {
    expect(adminAssignEventNote("Waldo Heat & Pipe")).toBe("Assigned by admin to Waldo Heat & Pipe");
    expect(adminAssignEventNote("Brookside Paint", "Waldo Heat & Pipe")).toBe(
      "Reassigned by admin from Waldo Heat & Pipe to Brookside Paint",
    );
  });
});

describe("filterApprovedContractorsForTrade", () => {
  it("keeps shops licensed for the job trade", () => {
    expect(filterApprovedContractorsForTrade(shops, "hvac").map((row) => row.id)).toEqual(["a"]);
    expect(filterApprovedContractorsForTrade(shops, "").map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("jobIsAssignable", () => {
  it("blocks cancelled jobs", () => {
    expect(jobIsAssignable("RECEIVED")).toBe(true);
    expect(jobIsAssignable("CANCELLED")).toBe(false);
  });
});
