import { beforeEach, describe, expect, it, vi } from "vitest";

const isOpsAuthenticated = vi.fn();
const lookupAdminIntakeClient = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  isOpsAuthenticated: (...args: unknown[]) => isOpsAuthenticated(...args),
}));

vi.mock("@/lib/admin-intake-action", () => ({
  lookupAdminIntakeClient: (...args: unknown[]) => lookupAdminIntakeClient(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { GET } from "./route";

describe("GET /api/admin/clients/lookup", () => {
  beforeEach(() => {
    isOpsAuthenticated.mockReset();
    lookupAdminIntakeClient.mockReset();
  });

  it("rejects callers who are not signed in as admin", async () => {
    isOpsAuthenticated.mockResolvedValue(false);
    const response = await GET(new Request("http://tod.test/api/admin/clients/lookup?phone=8165550199"));
    expect(response.status).toBe(401);
    expect(lookupAdminIntakeClient).not.toHaveBeenCalled();
  });

  it("returns a phone match for dispatch intake", async () => {
    isOpsAuthenticated.mockResolvedValue(true);
    lookupAdminIntakeClient.mockResolvedValue({
      customer: { id: "cus_1", name: "Jordan Hale", email: "jordan@home.example", phone: "8165550199" },
      lastAddress: { street: "4800 Main St", city: "Kansas City", state: "MO", zip: "64112" },
    });
    const response = await GET(new Request("http://tod.test/api/admin/clients/lookup?phone=8165550199"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { match: { customer: { name: string } } };
    expect(payload.match.customer.name).toBe("Jordan Hale");
  });
});
