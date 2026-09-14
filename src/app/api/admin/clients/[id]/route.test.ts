import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const deleteAdminClient = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/admin-client-delete", () => ({
  deleteAdminClient: (...args: unknown[]) => deleteAdminClient(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DELETE } from "./route";

describe("DELETE /api/admin/clients/[id]", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    deleteAdminClient.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await DELETE(
      new Request("http://tod.test/api/admin/clients/cus_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "Riley Chen" }),
      }),
      { params: Promise.resolve({ id: "cus_1" }) },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to admin." });
    expect(deleteAdminClient).not.toHaveBeenCalled();
  });

  it("returns 409 when the client still has active jobs", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    deleteAdminClient.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Cannot delete while 1 job is still active. Complete or cancel them first.",
      jobs: [{ id: "open", publicId: "TOD-OPEN01", status: "DISPATCHED" }],
    });
    const response = await DELETE(
      new Request("http://tod.test/api/admin/clients/cus_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "Riley Chen" }),
      }),
      { params: Promise.resolve({ id: "cus_1" }) },
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string; jobs: { publicId: string }[] };
    expect(payload.error).toMatch(/still active/);
    expect(payload.jobs[0].publicId).toBe("TOD-OPEN01");
  });

  it("deletes when admin is authenticated and confirm matches", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    deleteAdminClient.mockResolvedValue({ ok: true, name: "Riley Chen" });
    const response = await DELETE(
      new Request("http://tod.test/api/admin/clients/cus_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "Riley Chen" }),
      }),
      { params: Promise.resolve({ id: "cus_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, name: "Riley Chen" });
    expect(deleteAdminClient).toHaveBeenCalledWith("cus_1", "Riley Chen");
  });
});
