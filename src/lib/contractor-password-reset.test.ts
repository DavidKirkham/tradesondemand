import { afterEach, describe, expect, it } from "vitest";
import { contractorPasswordMatches } from "./contractor-password";
import {
  contractorPasswordResetConfirmDecision,
  contractorPasswordResetEligibility,
  generatePasswordResetCode,
  generatePasswordResetToken,
  hashPasswordResetCode,
  hashPasswordResetToken,
  parsePasswordResetCode,
  parsePasswordResetToken,
  PASSWORD_RESET_INVALID_MESSAGE,
  PASSWORD_RESET_IP_MAX_REQUESTS,
  passwordResetConfirmIpAllowed,
  passwordResetExpired,
  passwordResetOnCooldown,
  passwordResetRequestIpAllowed,
  passwordResetSecretsEqual,
  requestClientKey,
  resetPasswordResetIpLimitersForTests,
} from "./contractor-password-reset";
import { isPublicContractorPath, isSafeContractorNextPath } from "./contractor-paths";

afterEach(() => {
  resetPasswordResetIpLimitersForTests();
});

describe("contractorPasswordResetEligibility", () => {
  it("sends only to approved shops that already have a password", () => {
    expect(contractorPasswordResetEligibility(null)).toBe("ignore");
    expect(
      contractorPasswordResetEligibility({ status: "PENDING", passwordHash: "hash" }),
    ).toBe("ignore");
    expect(
      contractorPasswordResetEligibility({ status: "REJECTED", passwordHash: "hash" }),
    ).toBe("ignore");
    expect(
      contractorPasswordResetEligibility({ status: "APPROVED", passwordHash: null }),
    ).toBe("ignore");
    expect(
      contractorPasswordResetEligibility({ status: "APPROVED", passwordHash: "hash" }),
    ).toBe("send");
  });
});

describe("reset token + code helpers", () => {
  it("hashes tokens without echoing the secret", () => {
    const token = generatePasswordResetToken();
    const hash = hashPasswordResetToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashPasswordResetToken(token)).toBe(hash);
    expect(hashPasswordResetToken(`${token}x`)).not.toBe(hash);
    expect(passwordResetSecretsEqual(hash, hash)).toBe(true);
    expect(passwordResetSecretsEqual(hash, hashPasswordResetToken("other"))).toBe(false);
  });

  it("stores a bcrypt code hash that only the matching code verifies", async () => {
    const hash = await hashPasswordResetCode("482193");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await contractorPasswordMatches("482193", hash)).toBe(true);
    expect(await contractorPasswordMatches("000000", hash)).toBe(false);
  });

  it("generates a 6-digit code and accepts pasted reset URLs", () => {
    expect(generatePasswordResetCode()).toMatch(/^\d{6}$/);
    expect(parsePasswordResetCode("482-193")).toBe("482193");
    expect(parsePasswordResetCode("12345")).toBeNull();
    expect(parsePasswordResetToken("short")).toBeNull();
    const token = generatePasswordResetToken();
    expect(parsePasswordResetToken(token)).toBe(token);
    expect(parsePasswordResetToken(`https://todkc.com/contractor/r/${token}`)).toBe(token);
  });
});

describe("passwordResetOnCooldown / expired", () => {
  it("enforces a short SMS cooldown and 20-minute expiry", () => {
    const now = new Date("2026-09-13T16:00:00.000Z");
    expect(passwordResetOnCooldown(null, now)).toBe(false);
    expect(passwordResetOnCooldown(new Date("2026-09-13T15:59:00.000Z"), now)).toBe(true);
    expect(passwordResetOnCooldown(new Date("2026-09-13T15:58:00.000Z"), now)).toBe(false);
    expect(passwordResetExpired(new Date("2026-09-13T15:59:00.000Z"), now)).toBe(true);
    expect(passwordResetExpired(new Date("2026-09-13T16:10:00.000Z"), now)).toBe(false);
  });
});

describe("contractorPasswordResetConfirmDecision", () => {
  const reset = { expiresAt: new Date("2026-09-13T16:20:00.000Z"), attempts: 0 };
  const now = new Date("2026-09-13T16:00:00.000Z");

  it("rejects missing, expired, locked, and wrong secrets without leaking status", () => {
    expect(contractorPasswordResetConfirmDecision({ reset: null, secretOk: true })).toEqual({
      ok: false,
      status: 401,
      error: PASSWORD_RESET_INVALID_MESSAGE,
      lock: false,
    });
    expect(
      contractorPasswordResetConfirmDecision({
        reset,
        contractorStatus: "PENDING",
        secretOk: true,
        now,
      }),
    ).toMatchObject({ ok: false, lock: true });
    expect(
      contractorPasswordResetConfirmDecision({
        reset: { ...reset, expiresAt: new Date("2026-09-13T15:00:00.000Z") },
        secretOk: true,
        now,
      }),
    ).toMatchObject({ ok: false, lock: true });
    expect(
      contractorPasswordResetConfirmDecision({
        reset: { ...reset, attempts: 5 },
        secretOk: true,
        now,
      }),
    ).toMatchObject({ ok: false, lock: true });
    expect(
      contractorPasswordResetConfirmDecision({
        reset: { ...reset, attempts: 4 },
        secretOk: false,
        now,
      }),
    ).toMatchObject({ ok: false, lock: true });
    expect(
      contractorPasswordResetConfirmDecision({
        reset: { ...reset, attempts: 1 },
        secretOk: false,
        now,
      }),
    ).toMatchObject({ ok: false, lock: false });
  });

  it("accepts a valid unused code for an approved shop", () => {
    expect(
      contractorPasswordResetConfirmDecision({
        reset,
        contractorStatus: "APPROVED",
        secretOk: true,
        now,
      }),
    ).toEqual({ ok: true });
  });
});

describe("password reset IP limiters", () => {
  it("caps request and confirm attempts in a 15-minute window", () => {
    const start = Date.now();
    for (let i = 0; i < PASSWORD_RESET_IP_MAX_REQUESTS; i += 1) {
      expect(passwordResetRequestIpAllowed("1.1.1.1", start + i)).toBe(true);
    }
    expect(passwordResetRequestIpAllowed("1.1.1.1", start + 20)).toBe(false);
    expect(passwordResetRequestIpAllowed("2.2.2.2", start + 20)).toBe(true);
    expect(passwordResetConfirmIpAllowed("1.1.1.1", start)).toBe(true);
  });

  it("reads the first forwarded client address", () => {
    const request = new Request("http://localhost/api/contractor/password/reset", {
      headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.1" },
    });
    expect(requestClientKey(request)).toBe("198.51.100.10");
  });
});

describe("public reset paths", () => {
  it("exposes forgot + reset link pages without treating them as return paths", () => {
    expect(isPublicContractorPath("/contractor/forgot")).toBe(true);
    expect(isPublicContractorPath("/contractor/r/abc")).toBe(true);
    expect(isSafeContractorNextPath("/contractor/forgot")).toBe(false);
    expect(isSafeContractorNextPath("/contractor/r/secret")).toBe(false);
  });
});
