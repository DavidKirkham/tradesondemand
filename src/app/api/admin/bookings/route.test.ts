import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const createAdminPhoneJob = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/admin-intake-action", () => ({
  createAdminPhoneJob: (...args: unknown[]) => createAdminPhoneJob(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";

const body = {
  trade: "plumbing",
  problem: "Water heater leaking into the basement utility room.",
  urgency: "emergency",
  street: "4800 Main St",
  city: "Kansas City",
  state: "MO",
  zip: "64112",
  customerName: "Jordan Hale",
  customerPhone: "8165550199",
  customerEmail: "",
  contractorId: "shop_1",
  skipDeposit: true,
};

describe("POST /api/admin/bookings", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    createAdminPhoneJob.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await POST(
      new Request("http://tod.test/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to admin." });
    expect(createAdminPhoneJob).not.toHaveBeenCalled();
  });

  it("returns a validation error from intake", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    createAdminPhoneJob.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Pick an approved contractor to assign this call.",
      field: "contractorId",
    });
    const response = await POST(
      new Request("http://tod.test/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, contractorId: "" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Pick an approved contractor to assign this call.",
      field: "contractorId",
    });
  });

  it("creates and assigns a phone job for an authenticated admin", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    createAdminPhoneJob.mockResolvedValue({
      ok: true,
      booking: {
        id: "job_1",
        publicId: "TOD-PHONE1",
        status: "DISPATCHED",
        contractorId: "shop_1",
        contractorName: "Waldo Heat & Pipe",
      },
      customer: { id: "cus_1", created: true },
      assigned: true,
    });
    const response = await POST(
      new Request("http://tod.test/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      booking: { publicId: string; status: string };
      assigned: boolean;
    };
    expect(payload.booking.publicId).toBe("TOD-PHONE1");
    expect(payload.booking.status).toBe("DISPATCHED");
    expect(payload.assigned).toBe(true);
    expect(createAdminPhoneJob).toHaveBeenCalledWith(
      expect.objectContaining({
        trade: "plumbing",
        contractorId: "shop_1",
        skipDeposit: true,
      }),
    );
  });
});
