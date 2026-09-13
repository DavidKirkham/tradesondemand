import { afterEach, describe, expect, it } from "vitest";
import {
  buildAcceptEtaSms,
  buildContractorCustomerSms,
  buildContractorPasswordResetSms,
  describeContractorCustomerSms,
  describeContractorEtaSms,
  isTwilioConfigured,
  sendCustomerSms,
} from "./sms";

const keys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const;
const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("isTwilioConfigured", () => {
  it("requires sid, token, and from number", () => {
    expect(isTwilioConfigured({})).toBe(false);
    expect(
      isTwilioConfigured({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_AUTH_TOKEN: "secret",
        TWILIO_FROM_NUMBER: "+18165550100",
      }),
    ).toBe(true);
  });
});

describe("sendCustomerSms", () => {
  it("skips reserved 555 test numbers even when Twilio is configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACxxx";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_FROM_NUMBER = "+18165160735";
    const result = await sendCustomerSms("8165550199", "test body");
    expect(result.status).toBe("SKIPPED");
    expect(result.error).toMatch(/555 test number/i);
  });
});

describe("describeContractorEtaSms", () => {
  it("shows a skipped reason instead of calling the KC desk", () => {
    expect(
      describeContractorEtaSms({
        status: "SKIPPED",
        error: "Customer number is a reserved 555 test number. Twilio will not deliver it.",
        persistSkipped: true,
      }),
    ).toMatch(/SMS skipped: Customer number is a reserved 555/);
    expect(
      describeContractorEtaSms({
        status: "SKIPPED",
        error: "Customer number is a reserved 555 test number. Twilio will not deliver it.",
        persistSkipped: true,
      }),
    ).toMatch(/missing SMS columns/);
    expect(
      describeContractorEtaSms({
        status: "FAILED",
        error: "Twilio: The number +18165550199 is unverified.",
      }),
    ).toMatch(/SMS did not send: Twilio:/);
    expect(describeContractorEtaSms({ status: "FAILED", error: "Twilio HTTP 400" })).not.toMatch(/KC desk/);
  });
});

describe("buildContractorCustomerSms", () => {
  it("includes shop, job id, and the note", () => {
    const body = buildContractorCustomerSms({
      businessName: "Waldo Heat & Pipe",
      publicId: "TOD-OPEN01",
      message: "On my way — call if the gate code changed.",
    });
    expect(body).toContain("Waldo Heat & Pipe");
    expect(body).toContain("TOD-OPEN01");
    expect(body).toContain("gate code");
  });
});

describe("describeContractorCustomerSms", () => {
  it("explains skipped Twilio without mentioning the KC desk", () => {
    expect(
      describeContractorCustomerSms({
        status: "SKIPPED",
        error: "Customer number is a reserved 555 test number. Twilio will not deliver it.",
      }),
    ).toMatch(/SMS skipped: Customer number is a reserved 555/);
  });
});

describe("buildContractorPasswordResetSms", () => {
  it("includes the one-time code and reset link", () => {
    const body = buildContractorPasswordResetSms({
      code: "482193",
      resetUrl: "https://todkc.com/contractor/r/reset-token-example",
    });
    expect(body).toContain("482193");
    expect(body).toContain("https://todkc.com/contractor/r/reset-token-example");
    expect(body).toMatch(/20 min/i);
  });
});

describe("buildAcceptEtaSms", () => {
  it("includes shop, job id, and arrival note", () => {
    const body = buildAcceptEtaSms({
      businessName: "Waldo Heat & Pipe",
      publicId: "TOD-OPEN01",
      eta: "I can be there in about 45 minutes.",
    });
    expect(body).toContain("Waldo Heat & Pipe");
    expect(body).toContain("TOD-OPEN01");
    expect(body).toContain("45 minutes");
  });
});
