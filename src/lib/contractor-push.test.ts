import { describe, expect, it, vi } from "vitest";
import { contractorJobPath } from "./contractor-paths";
import {
  buildContractorBookedPush,
  buildContractorBookedSms,
  contractorAppOrigin,
  contractorBookedSnippet,
  contractorJobUrl,
  getVapidPublicKey,
  isGonePushStatus,
  isWebPushConfigured,
  shouldSendBookedSmsFallback,
  validatePushSubscription,
} from "./contractor-push";
import { sendWebPushToSubscription } from "./contractor-push-send";
import { notifyContractorBooked } from "./notify-contractor-booked";

const job = {
  id: "job_cuid_abc",
  publicId: "TOD-OPEN01",
  trade: "plumbing",
  urgency: "emergency",
  city: "Overland Park",
};

describe("contractor job deep path", () => {
  it("opens the contractor job page by booking id", () => {
    expect(contractorJobPath(job.id)).toBe("/contractor/jobs/job_cuid_abc");
    expect(contractorJobUrl("https://todkc.com/", job.id)).toBe(
      "https://todkc.com/contractor/jobs/job_cuid_abc",
    );
  });
});

describe("VAPID config", () => {
  it("needs both public and private keys", () => {
    expect(isWebPushConfigured({})).toBe(false);
    expect(
      isWebPushConfigured({
        VAPID_PUBLIC_KEY: "pub",
        VAPID_PRIVATE_KEY: "priv",
      }),
    ).toBe(true);
    expect(getVapidPublicKey({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "from-public" })).toBe("from-public");
  });
});

describe("booked notification copy", () => {
  it("includes job id, trade, urgency, and deep path", () => {
    expect(contractorBookedSnippet(job)).toBe("TOD-OPEN01 · Plumbing · emergency · Overland Park");
    const push = buildContractorBookedPush(job);
    expect(push.title).toMatch(/job/i);
    expect(push.body).toContain("TOD-OPEN01");
    expect(push.body).toContain("Plumbing");
    expect(push.body).toContain("emergency");
    expect(push.url).toBe("/contractor/jobs/job_cuid_abc");
  });

  it("SMS fallback links to the same contractor job path", () => {
    const body = buildContractorBookedSms(job, "https://www.tradesondemand.com");
    expect(body).toContain("TOD-OPEN01");
    expect(body).toContain("Plumbing");
    expect(body).toContain("https://www.tradesondemand.com/contractor/jobs/job_cuid_abc");
    expect(contractorAppOrigin({})).toBe("https://www.tradesondemand.com");
  });
});

describe("validatePushSubscription", () => {
  it("accepts an https endpoint with keys", () => {
    const parsed = validatePushSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p256", auth: "authkey" },
      userAgent: "Mozilla/5.0",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.endpoint).toContain("fcm.googleapis.com");
      expect(parsed.data.p256dh).toBe("p256");
    }
  });

  it("rejects http endpoints and missing keys", () => {
    expect(
      validatePushSubscription({
        endpoint: "http://evil.example/push",
        keys: { p256dh: "p256", auth: "authkey" },
      }).ok,
    ).toBe(false);
    expect(
      validatePushSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "", auth: "authkey" },
      }).ok,
    ).toBe(false);
  });
});

describe("shouldSendBookedSmsFallback", () => {
  it("is only a backup when no push delivered", () => {
    expect(shouldSendBookedSmsFallback({ pushDelivered: 1 })).toBe(false);
    expect(shouldSendBookedSmsFallback({ pushDelivered: 0 })).toBe(true);
  });
});

describe("sendWebPushToSubscription", () => {
  it("does not call the push service when VAPID keys are missing", async () => {
    const result = await sendWebPushToSubscription(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        p256dh: "p256",
        auth: "authkey",
      },
      { title: "New TOD job on your plate" },
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/VAPID/i);
  });
});

describe("isGonePushStatus", () => {
  it("treats 404 and 410 as stale subscriptions", () => {
    expect(isGonePushStatus(410)).toBe(true);
    expect(isGonePushStatus(404)).toBe(true);
    expect(isGonePushStatus(500)).toBe(false);
  });
});

describe("notifyContractorBooked", () => {
  const sub = {
    id: "sub_1",
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh: "p256",
    auth: "authkey",
  };

  it("sends push only to the assigned contractor's stored subscriptions", async () => {
    const listSubscriptions = vi.fn().mockResolvedValue([sub]);
    const sendPush = vi.fn().mockResolvedValue({ ok: true });
    const sendSms = vi.fn();

    const result = await notifyContractorBooked(
      { contractorId: "shop_a", contractorPhone: "8165160735", job },
      {
        listSubscriptions,
        sendPush,
        deleteSubscription: vi.fn(),
        sendSms,
      },
    );

    expect(listSubscriptions).toHaveBeenCalledWith("shop_a");
    expect(sendPush).toHaveBeenCalledOnce();
    expect(sendPush.mock.calls[0][0]).toEqual(sub);
    expect(sendPush.mock.calls[0][1]).toMatchObject({
      url: "/contractor/jobs/job_cuid_abc",
      body: expect.stringContaining("TOD-OPEN01"),
    });
    expect(sendSms).not.toHaveBeenCalled();
    expect(result).toEqual({ channel: "push", pushSent: 1 });
  });

  it("falls back to SMS when the shop has no push subscription", async () => {
    const sendSms = vi.fn().mockResolvedValue({ status: "SENT" });
    const result = await notifyContractorBooked(
      {
        contractorId: "shop_a",
        contractorPhone: "8165160735",
        job,
        origin: "https://todkc.com",
      },
      {
        listSubscriptions: async () => [],
        sendPush: vi.fn(),
        deleteSubscription: vi.fn(),
        sendSms,
      },
    );

    expect(sendSms).toHaveBeenCalledOnce();
    expect(sendSms.mock.calls[0][0]).toBe("8165160735");
    expect(sendSms.mock.calls[0][1]).toContain("/contractor/jobs/job_cuid_abc");
    expect(result.channel).toBe("sms");
  });

  it("drops gone subscriptions and texts if nothing delivers", async () => {
    const deleteSubscription = vi.fn();
    const sendSms = vi.fn().mockResolvedValue({ status: "SENT" });
    const result = await notifyContractorBooked(
      { contractorId: "shop_a", contractorPhone: "8165160735", job },
      {
        listSubscriptions: async () => [sub],
        sendPush: async () => ({ ok: false, gone: true, error: "gone" }),
        deleteSubscription,
        sendSms,
      },
    );

    expect(deleteSubscription).toHaveBeenCalledWith("sub_1");
    expect(result.channel).toBe("sms");
  });

  it("does not text when push already delivered", async () => {
    const sendSms = vi.fn();
    await notifyContractorBooked(
      { contractorId: "shop_a", contractorPhone: "8165160735", job },
      {
        listSubscriptions: async () => [sub],
        sendPush: async () => ({ ok: true }),
        deleteSubscription: vi.fn(),
        sendSms,
      },
    );
    expect(sendSms).not.toHaveBeenCalled();
  });
});
