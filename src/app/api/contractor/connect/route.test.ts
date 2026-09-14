import { beforeEach, describe, expect, it, vi } from "vitest";

const getApprovedContractorFromCookie = vi.fn();
const startContractorConnectOnboarding = vi.fn();
const refreshContractorConnectFromStripe = vi.fn();
const createContractorExpressLoginLink = vi.fn();

vi.mock("@/lib/contractor-auth", () => ({
  getApprovedContractorFromCookie: (...args: unknown[]) => getApprovedContractorFromCookie(...args),
}));

vi.mock("@/lib/contractor-connect", () => ({
  startContractorConnectOnboarding: (...args: unknown[]) => startContractorConnectOnboarding(...args),
  refreshContractorConnectFromStripe: (...args: unknown[]) => refreshContractorConnectFromStripe(...args),
  createContractorExpressLoginLink: (...args: unknown[]) => createContractorExpressLoginLink(...args),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { GET, POST } from "./route";

describe("POST /api/contractor/connect", () => {
  beforeEach(() => {
    getApprovedContractorFromCookie.mockReset();
    startContractorConnectOnboarding.mockReset();
    refreshContractorConnectFromStripe.mockReset();
    createContractorExpressLoginLink.mockReset();
  });

  it("rejects callers who are not signed in as an approved contractor", async () => {
    getApprovedContractorFromCookie.mockResolvedValue(null);
    const response = await POST(
      new Request("http://tod.test/api/contractor/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboard" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in as an approved contractor." });
    expect(startContractorConnectOnboarding).not.toHaveBeenCalled();
  });

  it("starts Account Link onboarding for an approved shop", async () => {
    const contractor = {
      id: "pro_1",
      businessName: "Waldo Heat & Pipe",
      email: "morgan@waldoheat.example",
      stripeConnectAccountId: null,
    };
    getApprovedContractorFromCookie.mockResolvedValue(contractor);
    startContractorConnectOnboarding.mockResolvedValue({ url: "https://connect.stripe.com/setup/e/acct_1" });
    const request = new Request("http://tod.test/api/contractor/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "onboard" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://connect.stripe.com/setup/e/acct_1" });
    expect(startContractorConnectOnboarding).toHaveBeenCalledWith({ request, contractor });
  });
});

describe("GET /api/contractor/connect", () => {
  beforeEach(() => {
    getApprovedContractorFromCookie.mockReset();
    refreshContractorConnectFromStripe.mockReset();
  });

  it("rejects unauthenticated callers", async () => {
    getApprovedContractorFromCookie.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
