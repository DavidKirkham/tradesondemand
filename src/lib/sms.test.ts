import { afterEach, describe, expect, it } from "vitest";
import { buildAcceptEtaSms, isTwilioConfigured } from "./sms";

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
