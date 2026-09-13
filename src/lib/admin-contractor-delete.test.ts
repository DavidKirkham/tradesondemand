import { describe, expect, it, vi } from "vitest";
import {
  blockingContractorJobs,
  confirmMatchesBusinessName,
  contractorDeleteBlockedMessage,
  deleteAdminContractor,
  type DeleteContractorStore,
} from "./admin-contractor-delete";

const shop = {
  id: "pro_1",
  businessName: "Waldo Heat & Pipe",
  bookings: [] as { id: string; publicId: string; status: string }[],
};

function store(overrides: Partial<DeleteContractorStore> = {}): DeleteContractorStore {
  return {
    findContractor: vi.fn(async () => shop),
    unassignClosedJobsAndDelete: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("confirmMatchesBusinessName", () => {
  it("matches trimmed case-insensitive names", () => {
    expect(confirmMatchesBusinessName("  waldo heat & pipe ", "Waldo Heat & Pipe")).toBe(true);
    expect(confirmMatchesBusinessName("Waldo Heat", "Waldo Heat & Pipe")).toBe(false);
    expect(confirmMatchesBusinessName("", "Waldo Heat & Pipe")).toBe(false);
  });
});

describe("blockingContractorJobs", () => {
  it("blocks open jobs and allows completed or cancelled history", () => {
    const jobs = [
      { id: "1", publicId: "TOD-OPEN01", status: "DISPATCHED" },
      { id: "2", publicId: "TOD-DONE01", status: "COMPLETED" },
      { id: "3", publicId: "TOD-CXL01", status: "CANCELLED" },
      { id: "4", publicId: "TOD-SITE01", status: "ON_SITE" },
    ];
    expect(blockingContractorJobs(jobs).map((job) => job.publicId)).toEqual([
      "TOD-OPEN01",
      "TOD-SITE01",
    ]);
    expect(contractorDeleteBlockedMessage(blockingContractorJobs(jobs))).toMatch(/2 jobs are still active/);
  });
});

describe("deleteAdminContractor", () => {
  it("deletes after typed confirm and unassigns closed jobs only via the store", async () => {
    const closed = {
      ...shop,
      bookings: [
        { id: "done", publicId: "TOD-DONE01", status: "COMPLETED" },
        { id: "cxl", publicId: "TOD-CXL01", status: "CANCELLED" },
      ],
    };
    const db = store({ findContractor: vi.fn(async () => closed) });
    const result = await deleteAdminContractor(shop.id, "Waldo Heat & Pipe", db);
    expect(result).toEqual({ ok: true, businessName: "Waldo Heat & Pipe" });
    expect(db.unassignClosedJobsAndDelete).toHaveBeenCalledWith(shop.id);
  });

  it("rejects a missing shop", async () => {
    const db = store({ findContractor: async () => null });
    const result = await deleteAdminContractor("missing", "Waldo Heat & Pipe", db);
    expect(result).toEqual({ ok: false, status: 404, error: "Subcontractor not found." });
    expect(db.unassignClosedJobsAndDelete).not.toHaveBeenCalled();
  });

  it("rejects a confirm that does not match the business name", async () => {
    const db = store();
    const result = await deleteAdminContractor(shop.id, "wrong shop", db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(db.unassignClosedJobsAndDelete).not.toHaveBeenCalled();
  });

  it("blocks delete when an active job is still assigned", async () => {
    const db = store({
      findContractor: async () => ({
        ...shop,
        bookings: [{ id: "open", publicId: "TOD-OPEN01", status: "EN_ROUTE" }],
      }),
    });
    const result = await deleteAdminContractor(shop.id, "Waldo Heat & Pipe", db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/still active/);
      expect(result.jobs?.[0].publicId).toBe("TOD-OPEN01");
    }
    expect(db.unassignClosedJobsAndDelete).not.toHaveBeenCalled();
  });
});
