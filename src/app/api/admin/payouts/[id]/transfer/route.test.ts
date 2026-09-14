import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const executePayoutTransfer = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/contractor-connect", () => ({
  executePayoutTransfer: (...args: unknown[]) => executePayoutTransfer(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";

describe("POST /api/admin/payouts/[id]/transfer", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    executePayoutTransfer.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await POST(new Request("http://tod.test/api/admin/payouts/po_1/transfer", { method: "POST" }), {
      params: Promise.resolve({ id: "po_1" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to admin." });
    expect(executePayoutTransfer).not.toHaveBeenCalled();
  });

  it("transfers shop earnings when admin is authenticated", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    executePayoutTransfer.mockResolvedValue({
      ok: true,
      payout: { id: "po_1", status: "PAID", stripeTransferId: "tr_1", shopAmountCents: 36400 },
    });
    const response = await POST(new Request("http://tod.test/api/admin/payouts/po_1/transfer", { method: "POST" }), {
      params: Promise.resolve({ id: "po_1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      payout: { id: "po_1", status: "PAID", stripeTransferId: "tr_1", shopAmountCents: 36400 },
    });
    expect(executePayoutTransfer).toHaveBeenCalledWith("po_1");
  });
});
