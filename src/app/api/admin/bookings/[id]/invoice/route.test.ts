import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const saveAdminInvoice = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/admin-invoice-edit", () => ({
  saveAdminInvoice: (...args: unknown[]) => saveAdminInvoice(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { PATCH } from "./route";

describe("PATCH /api/admin/bookings/[id]/invoice", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    saveAdminInvoice.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await PATCH(
      new Request("http://tod.test/api/admin/bookings/job_1/invoice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labor: [{ hours: "1", rate: "110" }] }),
      }),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to admin." });
    expect(saveAdminInvoice).not.toHaveBeenCalled();
  });

  it("returns 400 when the invoice is already paid", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    saveAdminInvoice.mockResolvedValue({
      ok: false,
      status: 400,
      error: "This invoice is already paid to TOD.",
    });
    const response = await PATCH(
      new Request("http://tod.test/api/admin/bookings/job_1/invoice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labor: [{ hours: "1", rate: "110" }] }),
      }),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "This invoice is already paid to TOD." });
  });

  it("saves when admin is authenticated", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    saveAdminInvoice.mockResolvedValue({
      ok: true,
      invoice: { publicId: "INV-DONE01", amountDueCents: 20000 },
    });
    const body = {
      labor: [{ description: "HVAC labor", hours: "2", rate: "110" }],
      materials: [{ description: "Blower motor", cost: "169" }],
    };
    const response = await PATCH(
      new Request("http://tod.test/api/admin/bookings/job_1/invoice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      invoice: { publicId: "INV-DONE01", amountDueCents: 20000 },
    });
    expect(saveAdminInvoice).toHaveBeenCalledWith("job_1", body);
  });
});
