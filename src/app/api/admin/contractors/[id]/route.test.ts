import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const deleteAdminContractor = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/admin-contractor-delete", () => ({
  deleteAdminContractor: (...args: unknown[]) => deleteAdminContractor(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DELETE } from "./route";

describe("DELETE /api/admin/contractors/[id]", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    deleteAdminContractor.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await DELETE(
      new Request("http://tod.test/api/admin/contractors/pro_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "Waldo Heat & Pipe" }),
      }),
      { params: Promise.resolve({ id: "pro_1" }) },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to admin." });
    expect(deleteAdminContractor).not.toHaveBeenCalled();
  });

  it("returns 409 when the shop still has active jobs", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    deleteAdminContractor.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Cannot delete while 1 job is still active. Reassign, complete, or cancel them first.",
      jobs: [{ id: "open", publicId: "TOD-OPEN01", status: "DISPATCHED" }],
    });
    const response = await DELETE(
      new Request("http://tod.test/api/admin/contractors/pro_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "Waldo Heat & Pipe" }),
      }),
      { params: Promise.resolve({ id: "pro_1" }) },
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string; jobs: { publicId: string }[] };
    expect(payload.error).toMatch(/still active/);
    expect(payload.jobs[0].publicId).toBe("TOD-OPEN01");
  });

  it("deletes when admin is authenticated and confirm matches", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    deleteAdminContractor.mockResolvedValue({ ok: true, businessName: "Waldo Heat & Pipe" });
    const response = await DELETE(
      new Request("http://tod.test/api/admin/contractors/pro_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "Waldo Heat & Pipe" }),
      }),
      { params: Promise.resolve({ id: "pro_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, businessName: "Waldo Heat & Pipe" });
    expect(deleteAdminContractor).toHaveBeenCalledWith("pro_1", "Waldo Heat & Pipe");
  });
});
