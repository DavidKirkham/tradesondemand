import { describe, expect, it } from "vitest";
import {
  canBootstrapContractorPassword,
  contractorPasswordLoginDecision,
  contractorPasswordMatches,
  hashContractorPassword,
  magicLinkIntent,
  parseContractorIdentifier,
  validateContractorPassword,
} from "./contractor-password";
import { contractorLoginHref, isPublicContractorPath, isSafeContractorNextPath } from "./contractor-paths";

describe("validateContractorPassword", () => {
  it("requires at least 10 characters", () => {
    expect(validateContractorPassword("short").ok).toBe(false);
    expect(validateContractorPassword("long-enough").ok).toBe(true);
    expect(validateContractorPassword("x".repeat(129)).ok).toBe(false);
  });
});

describe("hash + verify", () => {
  it("accepts the matching password and rejects a wrong one", async () => {
    const hash = await hashContractorPassword("correct-horse");
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).not.toContain("correct-horse");
    expect(await contractorPasswordMatches("correct-horse", hash)).toBe(true);
    expect(await contractorPasswordMatches("wrong-password", hash)).toBe(false);
    expect(await contractorPasswordMatches("correct-horse", null)).toBe(false);
  });
});

describe("parseContractorIdentifier", () => {
  it("accepts email, phone, and public id", () => {
    expect(parseContractorIdentifier("Morgan@WaldoHeat.example")).toEqual({
      kind: "email",
      value: "morgan@waldoheat.example",
    });
    expect(parseContractorIdentifier("(816) 516-0735")).toEqual({
      kind: "phone",
      value: "8165160735",
    });
    expect(parseContractorIdentifier("pro-d71b72")).toEqual({
      kind: "publicId",
      value: "PRO-D71B72",
    });
    expect(parseContractorIdentifier("not-an-id")).toBeNull();
  });
});

describe("contractorPasswordLoginDecision", () => {
  it("rejects unknown shops without leaking whether they exist", () => {
    expect(contractorPasswordLoginDecision({ contractor: null, passwordOk: false })).toEqual({
      ok: false,
      status: 401,
      error: "Sign-in failed.",
    });
  });

  it("blocks pending and rejected applications", () => {
    expect(
      contractorPasswordLoginDecision({
        contractor: { status: "PENDING", passwordHash: "hash" },
        passwordOk: true,
      }).ok,
    ).toBe(false);
    expect(
      contractorPasswordLoginDecision({
        contractor: { status: "REJECTED", passwordHash: "hash" },
        passwordOk: true,
      }),
    ).toMatchObject({ status: 403 });
  });

  it("requires a password to be set, then a correct password", () => {
    expect(
      contractorPasswordLoginDecision({
        contractor: { status: "APPROVED", passwordHash: null },
        passwordOk: false,
      }),
    ).toMatchObject({ status: 409 });
    expect(
      contractorPasswordLoginDecision({
        contractor: { status: "APPROVED", passwordHash: "hash" },
        passwordOk: false,
      }),
    ).toEqual({ ok: false, status: 401, error: "Sign-in failed." });
    expect(
      contractorPasswordLoginDecision({
        contractor: { status: "APPROVED", passwordHash: "hash" },
        passwordOk: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("magicLinkIntent", () => {
  it("is a one-time set-password bootstrap when no hash exists", () => {
    expect(magicLinkIntent(null)).toBe("reject");
    expect(magicLinkIntent({ status: "PENDING", passwordHash: null })).toBe("reject");
    expect(magicLinkIntent({ status: "APPROVED", passwordHash: null })).toBe("setup");
    expect(magicLinkIntent({ status: "APPROVED", passwordHash: "hash" })).toBe("signin");
  });
});

describe("canBootstrapContractorPassword", () => {
  it("only allows approved shops that have not set a password", () => {
    expect(canBootstrapContractorPassword({ status: "APPROVED", passwordHash: null })).toBe(true);
    expect(canBootstrapContractorPassword({ status: "APPROVED", passwordHash: "hash" })).toBe(false);
    expect(canBootstrapContractorPassword({ status: "PENDING", passwordHash: null })).toBe(false);
  });
});

describe("contractor return paths", () => {
  it("allows in-app contractor paths and rejects open redirects", () => {
    expect(isSafeContractorNextPath("/contractor/jobs/abc")).toBe(true);
    expect(isSafeContractorNextPath("/contractor/profile")).toBe(true);
    expect(isSafeContractorNextPath("/admin")).toBe(false);
    expect(isSafeContractorNextPath("//evil.example")).toBe(false);
    expect(isSafeContractorNextPath("/contractor/s/secret")).toBe(false);
    expect(isSafeContractorNextPath("/contractor/forgot")).toBe(false);
    expect(isSafeContractorNextPath("/contractor/r/secret")).toBe(false);
    expect(contractorLoginHref("/contractor/jobs/abc")).toBe(
      "/contractor?next=%2Fcontractor%2Fjobs%2Fabc",
    );
    expect(contractorLoginHref("/book")).toBe("/contractor");
  });

  it("treats login, forgot-password, magic-link, and manifest routes as public", () => {
    expect(isPublicContractorPath("/contractor")).toBe(true);
    expect(isPublicContractorPath("/contractor/forgot")).toBe(true);
    expect(isPublicContractorPath("/contractor/s/tod-waldo-demo")).toBe(true);
    expect(isPublicContractorPath("/contractor/r/reset-token")).toBe(true);
    expect(isPublicContractorPath("/contractor/manifest.webmanifest")).toBe(true);
    expect(isPublicContractorPath("/contractor/jobs/abc")).toBe(false);
    expect(isPublicContractorPath("/contractor/profile")).toBe(false);
  });
});
