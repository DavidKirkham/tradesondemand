import { describe, expect, it, vi } from "vitest";
import {
  blockingClientJobs,
  clientDeleteBlockedMessage,
  confirmMatchesClientName,
  deleteAdminClient,
  type DeleteClientStore,
} from "./admin-client-delete";

const client = {
  id: "cus_1",
  name: "Riley Chen",
  bookings: [] as { id: string; publicId: string; status: string }[],
};

function store(overrides: Partial<DeleteClientStore> = {}): DeleteClientStore {
  return {
    findClient: vi.fn(async () => client),
    unlinkClosedJobsAndDelete: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("confirmMatchesClientName", () => {
  it("matches trimmed case-insensitive names", () => {
    expect(confirmMatchesClientName("  riley chen ", "Riley Chen")).toBe(true);
    expect(confirmMatchesClientName("Riley", "Riley Chen")).toBe(false);
    expect(confirmMatchesClientName("", "Riley Chen")).toBe(false);
  });
});

describe("blockingClientJobs", () => {
  it("blocks open jobs and allows completed or cancelled history", () => {
    const jobs = [
      { id: "1", publicId: "TOD-OPEN01", status: "DISPATCHED" },
      { id: "2", publicId: "TOD-DONE01", status: "COMPLETED" },
      { id: "3", publicId: "TOD-CXL01", status: "CANCELLED" },
      { id: "4", publicId: "TOD-NEW01", status: "RECEIVED" },
    ];
    expect(blockingClientJobs(jobs).map((job) => job.publicId)).toEqual([
      "TOD-OPEN01",
      "TOD-NEW01",
    ]);
    expect(clientDeleteBlockedMessage(blockingClientJobs(jobs))).toMatch(/2 jobs are still active/);
  });
});

describe("deleteAdminClient", () => {
  it("deletes after typed confirm and unlinks closed jobs only via the store", async () => {
    const closed = {
      ...client,
      bookings: [
        { id: "done", publicId: "TOD-DONE01", status: "COMPLETED" },
        { id: "cxl", publicId: "TOD-CXL01", status: "CANCELLED" },
      ],
    };
    const db = store({ findClient: vi.fn(async () => closed) });
    const result = await deleteAdminClient(client.id, "Riley Chen", db);
    expect(result).toEqual({ ok: true, name: "Riley Chen" });
    expect(db.unlinkClosedJobsAndDelete).toHaveBeenCalledWith(client.id);
  });

  it("rejects a missing client", async () => {
    const db = store({ findClient: async () => null });
    const result = await deleteAdminClient("missing", "Riley Chen", db);
    expect(result).toEqual({ ok: false, status: 404, error: "Client not found." });
    expect(db.unlinkClosedJobsAndDelete).not.toHaveBeenCalled();
  });

  it("rejects a confirm that does not match the client name", async () => {
    const db = store();
    const result = await deleteAdminClient(client.id, "wrong name", db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(db.unlinkClosedJobsAndDelete).not.toHaveBeenCalled();
  });

  it("blocks delete when an active job is still on the client", async () => {
    const db = store({
      findClient: async () => ({
        ...client,
        bookings: [{ id: "open", publicId: "TOD-OPEN01", status: "EN_ROUTE" }],
      }),
    });
    const result = await deleteAdminClient(client.id, "Riley Chen", db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/still active/);
      expect(result.jobs?.[0].publicId).toBe("TOD-OPEN01");
    }
    expect(db.unlinkClosedJobsAndDelete).not.toHaveBeenCalled();
  });
});
