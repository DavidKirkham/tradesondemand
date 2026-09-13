import { describe, expect, it } from "vitest";
import {
  buildCustomerResetSms,
  canBootstrapCustomerPassword,
  customerExistsRegisterMessage,
  customerMagicLinkIntent,
  customerPasswordLoginDecision,
  customerPasswordMatches,
  customerResetCodeIsFresh,
  customerResetCodeMatches,
  customerResetExpiresAt,
  hashCustomerPassword,
  hashCustomerResetCode,
  validateCustomerPassword,
  validateCustomerRegister,
} from "./customer-password";
import {
  customerLoginHref,
  isPublicAccountPath,
  isSafeAccountNextPath,
} from "./customer-paths";

describe("validateCustomerPassword", () => {
  it("requires at least 10 characters", () => {
    expect(validateCustomerPassword("short").ok).toBe(false);
    expect(validateCustomerPassword("long-enough").ok).toBe(true);
    expect(validateCustomerPassword("x".repeat(129)).ok).toBe(false);
  });
});

describe("hash + verify", () => {
  it("accepts the matching password and rejects a wrong one", async () => {
    const hash = await hashCustomerPassword("correct-horse");
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).not.toContain("correct-horse");
    expect(await customerPasswordMatches("correct-horse", hash)).toBe(true);
    expect(await customerPasswordMatches("wrong-password", hash)).toBe(false);
    expect(await customerPasswordMatches("correct-horse", null)).toBe(false);
  });
});

describe("customerPasswordLoginDecision", () => {
  it("rejects unknown customers without leaking whether they exist", () => {
    expect(customerPasswordLoginDecision({ customer: null, passwordOk: false })).toEqual({
      ok: false,
      status: 401,
      error: "Sign-in failed.",
    });
  });

  it("requires a password to be set, then a correct password", () => {
    expect(
      customerPasswordLoginDecision({
        customer: { passwordHash: null },
        passwordOk: false,
      }),
    ).toMatchObject({ status: 409 });
    expect(
      customerPasswordLoginDecision({
        customer: { passwordHash: "hash" },
        passwordOk: false,
      }),
    ).toEqual({ ok: false, status: 401, error: "Sign-in failed." });
    expect(
      customerPasswordLoginDecision({
        customer: { passwordHash: "hash" },
        passwordOk: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("customerMagicLinkIntent", () => {
  it("is a one-time set-password bootstrap when no hash exists", () => {
    expect(customerMagicLinkIntent(null)).toBe("reject");
    expect(customerMagicLinkIntent({ passwordHash: null })).toBe("setup");
    expect(customerMagicLinkIntent({ passwordHash: "hash" })).toBe("signin");
  });
});

describe("canBootstrapCustomerPassword", () => {
  it("only allows customers that have not set a password", () => {
    expect(canBootstrapCustomerPassword({ passwordHash: null })).toBe(true);
    expect(canBootstrapCustomerPassword({ passwordHash: "hash" })).toBe(false);
  });
});

describe("validateCustomerRegister", () => {
  it("accepts a complete new-customer payload", () => {
    const result = validateCustomerRegister({
      name: "Riley Chen",
      email: "Riley@Home.example",
      phone: "(816) 555-0144",
      password: "riley-demo-10",
      confirm: "riley-demo-10",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe("riley@home.example");
      expect(result.phone).toBe("8165550144");
    }
  });

  it("rejects mismatched passwords and bad contact info", () => {
    expect(
      validateCustomerRegister({
        name: "Riley Chen",
        email: "riley@home.example",
        phone: "8165550144",
        password: "riley-demo-10",
        confirm: "different-10",
      }).ok,
    ).toBe(false);
    expect(validateCustomerRegister({ name: "R", email: "riley@home.example" }).ok).toBe(false);
  });
});

describe("customerExistsRegisterMessage", () => {
  it("points existing profiles at claim or sign-in", () => {
    expect(customerExistsRegisterMessage(false)).toMatch(/Claim your profile/);
    expect(customerExistsRegisterMessage(true)).toMatch(/Sign in/);
  });
});

describe("reset codes", () => {
  it("hashes and matches a 6-digit code", () => {
    const hash = hashCustomerResetCode("042891");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("042891");
    expect(customerResetCodeMatches("042891", hash)).toBe(true);
    expect(customerResetCodeMatches("000000", hash)).toBe(false);
    expect(customerResetCodeMatches("042891", null)).toBe(false);
  });

  it("treats an expiry in the future as fresh", () => {
    const expires = customerResetExpiresAt(new Date("2026-09-13T16:00:00.000Z"));
    expect(expires.toISOString()).toBe("2026-09-13T16:15:00.000Z");
    expect(customerResetCodeIsFresh(expires, new Date("2026-09-13T16:10:00.000Z"))).toBe(true);
    expect(customerResetCodeIsFresh(expires, new Date("2026-09-13T16:16:00.000Z"))).toBe(false);
    expect(customerResetCodeIsFresh(null)).toBe(false);
  });

  it("builds an SMS that includes the code and dispatch number", () => {
    expect(buildCustomerResetSms("042891")).toMatch(/042891/);
    expect(buildCustomerResetSms("042891")).toMatch(/816/);
  });
});

describe("customer return paths", () => {
  it("allows in-app account paths and rejects open redirects", () => {
    expect(isSafeAccountNextPath("/account")).toBe(true);
    expect(isSafeAccountNextPath("/account/jobs/TOD-DEMO01")).toBe(true);
    expect(isSafeAccountNextPath("/account/profile")).toBe(true);
    expect(isSafeAccountNextPath("/admin")).toBe(false);
    expect(isSafeAccountNextPath("//evil.example")).toBe(false);
    expect(isSafeAccountNextPath("/account/s/secret")).toBe(false);
    expect(isSafeAccountNextPath("/contractor")).toBe(false);
    expect(customerLoginHref("/account/jobs/TOD-DEMO01")).toBe(
      "/account/login?next=%2Faccount%2Fjobs%2FTOD-DEMO01",
    );
    expect(customerLoginHref("/book")).toBe("/account/login");
  });

  it("treats login, reset, and magic-link routes as public", () => {
    expect(isPublicAccountPath("/account/login")).toBe(true);
    expect(isPublicAccountPath("/account/forgot")).toBe(true);
    expect(isPublicAccountPath("/account/reset")).toBe(true);
    expect(isPublicAccountPath("/account/s/demo-customer-token-kc")).toBe(true);
    expect(isPublicAccountPath("/account/demo-customer-token-kc")).toBe(true);
    expect(isPublicAccountPath("/account")).toBe(false);
    expect(isPublicAccountPath("/account/jobs/TOD-DEMO01")).toBe(false);
    expect(isPublicAccountPath("/account/profile")).toBe(false);
  });
});
