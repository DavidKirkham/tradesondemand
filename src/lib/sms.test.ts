import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAcceptEtaSms,
  buildContractorCustomerSms,
  buildContractorPasswordResetSms,
  describeContractorCustomerSms,
  describeContractorEtaSms,
  getTwilioRequestAuth,
  isTwilioConfigured,
  sendCustomerSms,
} from "./sms";

const keys = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_FROM_NUMBER",
] as const;
const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of keys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("isTwilioConfigured", () => {
  it("is false when nothing is set", () => {
    expect(isTwilioConfigured({})).toBe(false);
  });

  it("accepts Account SID + Auth Token + From", () => {
    expect(
      isTwilioConfigured({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_AUTH_TOKEN: "secret",
        TWILIO_FROM_NUMBER: "+18165550100",
      }),
    ).toBe(true);
  });

  it("accepts API Key SID + secret + From without an Auth Token", () => {
    expect(
      isTwilioConfigured({
        TWILIO_API_KEY_SID: "SKxxx",
        TWILIO_API_KEY_SECRET: "key-secret",
        TWILIO_FROM_NUMBER: "+18165550100",
      }),
    ).toBe(true);
  });

  it("is false when From is missing", () => {
    expect(
      isTwilioConfigured({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_AUTH_TOKEN: "secret",
      }),
    ).toBe(false);
    expect(
      isTwilioConfigured({
        TWILIO_API_KEY_SID: "SKxxx",
        TWILIO_API_KEY_SECRET: "key-secret",
      }),
    ).toBe(false);
  });

  it("is false when only one API key field is set and Auth Token is missing", () => {
    expect(
      isTwilioConfigured({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_API_KEY_SID: "SKxxx",
        TWILIO_FROM_NUMBER: "+18165550100",
      }),
    ).toBe(false);
    expect(
      isTwilioConfigured({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_API_KEY_SECRET: "key-secret",
        TWILIO_FROM_NUMBER: "+18165550100",
      }),
    ).toBe(false);
  });
});

describe("getTwilioRequestAuth", () => {
  it("uses Account SID and Auth Token for Basic auth when API key vars are unset", () => {
    expect(
      getTwilioRequestAuth({
        TWILIO_ACCOUNT_SID: "ACaccount",
        TWILIO_AUTH_TOKEN: "auth-token",
        TWILIO_FROM_NUMBER: "+18165160735",
      }),
    ).toEqual({
      accountSid: "ACaccount",
      username: "ACaccount",
      password: "auth-token",
    });
  });

  it("uses API Key SID and secret for Basic auth and keeps Account SID for the URL", () => {
    expect(
      getTwilioRequestAuth({
        TWILIO_ACCOUNT_SID: "ACaccount",
        TWILIO_API_KEY_SID: "SKkey",
        TWILIO_API_KEY_SECRET: "key-secret",
        TWILIO_FROM_NUMBER: "+18165160735",
      }),
    ).toEqual({
      accountSid: "ACaccount",
      username: "SKkey",
      password: "key-secret",
    });
  });

  it("prefers API key credentials over Auth Token when both are set", () => {
    expect(
      getTwilioRequestAuth({
        TWILIO_ACCOUNT_SID: "ACaccount",
        TWILIO_AUTH_TOKEN: "auth-token",
        TWILIO_API_KEY_SID: "SKkey",
        TWILIO_API_KEY_SECRET: "key-secret",
        TWILIO_FROM_NUMBER: "+18165160735",
      }),
    ).toEqual({
      accountSid: "ACaccount",
      username: "SKkey",
      password: "key-secret",
    });
  });

  it("does not put an SK API Key SID in the Accounts URL path", () => {
    const auth = getTwilioRequestAuth({
      TWILIO_ACCOUNT_SID: "ACaccount",
      TWILIO_API_KEY_SID: "SKkey",
      TWILIO_API_KEY_SECRET: "key-secret",
      TWILIO_FROM_NUMBER: "+18165160735",
    });
    expect(auth?.accountSid).toBe("ACaccount");
    expect(auth?.accountSid.startsWith("AC")).toBe(true);
    expect(auth?.username).toBe("SKkey");
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

  it("posts to the Account SID path with API Key Basic auth", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACaccount";
    process.env.TWILIO_API_KEY_SID = "SKkey";
    process.env.TWILIO_API_KEY_SECRET = "key-secret";
    process.env.TWILIO_FROM_NUMBER = "+18165160735";
    delete process.env.TWILIO_AUTH_TOKEN;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SMxxx" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCustomerSms("8165160735", "hello");
    expect(result).toEqual({ status: "SENT" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACaccount/Messages.json");
    expect(url).not.toContain("SKkey");
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("SKkey:key-secret").toString("base64")}`,
    });
  });

  it("falls back to Account SID + Auth Token Basic auth when API key vars are unset", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACaccount";
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.TWILIO_FROM_NUMBER = "+18165160735";
    delete process.env.TWILIO_API_KEY_SID;
    delete process.env.TWILIO_API_KEY_SECRET;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SMxxx" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendCustomerSms("8165160735", "hello");
    expect(result).toEqual({ status: "SENT" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACaccount/Messages.json");
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("ACaccount:auth-token").toString("base64")}`,
    });
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
