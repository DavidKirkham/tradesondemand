import { afterEach, describe, expect, it } from "vitest";
import { isAdminPasswordConfigured, opsPassword, passwordMatches } from "./ops-auth";

const keys = ["ADMIN_PASSWORD", "OPS_PASSWORD"] as const;
const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("opsPassword", () => {
  it("prefers ADMIN_PASSWORD over OPS_PASSWORD", () => {
    process.env.ADMIN_PASSWORD = "owner-secret";
    process.env.OPS_PASSWORD = "legacy-ops";
    expect(opsPassword()).toBe("owner-secret");
    expect(passwordMatches("owner-secret")).toBe(true);
    expect(passwordMatches("legacy-ops")).toBe(false);
  });

  it("falls back to OPS_PASSWORD when ADMIN_PASSWORD is unset", () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.OPS_PASSWORD = "legacy-ops";
    expect(opsPassword()).toBe("legacy-ops");
    expect(passwordMatches("legacy-ops")).toBe(true);
  });

  it("has no hardcoded default when both env vars are empty", () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.OPS_PASSWORD;
    expect(opsPassword()).toBe("");
    expect(isAdminPasswordConfigured()).toBe(false);
    expect(passwordMatches("")).toBe(false);
    expect(passwordMatches("dispatch")).toBe(false);
  });
});
