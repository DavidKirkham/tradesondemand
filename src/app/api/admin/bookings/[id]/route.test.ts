import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const deleteAdminJob = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/admin-job-delete", () => ({
  deleteAdminJob: (...args: unknown[]) => deleteAdminJob(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DELETE } from "./route";

describe("DELETE /api/admin/bookings/[id]", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    deleteAdminJob.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await DELETE(
      new Request("http://tod.test/api/admin/bookings/job_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "TOD-ABC123" }),
      }),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to admin." });
    expect(deleteAdminJob).not.toHaveBeenCalled();
  });

  it("returns 409 when the job still has a paid invoice", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    deleteAdminJob.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Cannot delete while 1 paid invoice is on this job. Refund them first, or leave the job on the books.",
      payments: [
        {
          id: "pay_paid",
          publicId: "PAY-PAID01",
          status: "PAID",
          type: "DEPOSIT",
          amountCents: 8900,
          stripeCheckoutSessionId: "cs_paid",
        },
      ],
    });
    const response = await DELETE(
      new Request("http://tod.test/api/admin/bookings/job_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "TOD-ABC123" }),
      }),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string; payments: { publicId: string }[] };
    expect(payload.error).toMatch(/paid invoice/);
    expect(payload.payments[0].publicId).toBe("PAY-PAID01");
  });

  it("deletes when admin is authenticated and confirm matches", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    deleteAdminJob.mockResolvedValue({ ok: true, publicId: "TOD-ABC123" });
    const response = await DELETE(
      new Request("http://tod.test/api/admin/bookings/job_1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "TOD-ABC123" }),
      }),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, publicId: "TOD-ABC123" });
    expect(deleteAdminJob).toHaveBeenCalledWith("job_1", "TOD-ABC123");
  });
});
