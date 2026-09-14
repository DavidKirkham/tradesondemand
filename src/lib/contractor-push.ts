import { isSchemaMismatchError } from "./api-errors";
import { contractorJobPath } from "./contractor-paths";
import { getTrade } from "./trades";

export type ContractorBookedJob = {
  id: string;
  publicId: string;
  trade: string;
  urgency: string;
  city?: string | null;
};

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export type StoredPushSubscription = PushSubscriptionInput & { id: string };

export type ContractorBookedPushPayload = {
  title: string;
  body: string;
  url: string;
};

export type NotifyBookedChannel = "push" | "sms" | "none";

export type NotifyBookedResult = {
  channel: NotifyBookedChannel;
  pushSent: number;
  smsStatus?: string;
  error?: string;
};

export function contractorAppOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://www.tradesondemand.com";
}

export function contractorJobUrl(origin: string, bookingId: string): string {
  return `${origin.replace(/\/$/, "")}${contractorJobPath(bookingId)}`;
}

export function getVapidPublicKey(env: Record<string, string | undefined> = process.env): string {
  return env.VAPID_PUBLIC_KEY?.trim() || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
}

export function getVapidPrivateKey(env: Record<string, string | undefined> = process.env): string {
  return env.VAPID_PRIVATE_KEY?.trim() || "";
}

export function getVapidSubject(env: Record<string, string | undefined> = process.env): string {
  return env.VAPID_SUBJECT?.trim() || "https://www.tradesondemand.com";
}

export function isWebPushConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(getVapidPublicKey(env) && getVapidPrivateKey(env));
}

export function contractorBookedSnippet(job: ContractorBookedJob): string {
  const trade = getTrade(job.trade)?.name ?? job.trade;
  const parts = [job.publicId, trade, job.urgency.trim()];
  const city = job.city?.trim();
  if (city) parts.push(city);
  return parts.filter(Boolean).join(" · ");
}

export function buildContractorBookedPush(job: ContractorBookedJob): ContractorBookedPushPayload {
  return {
    title: "New TOD job on your plate",
    body: contractorBookedSnippet(job),
    url: contractorJobPath(job.id),
  };
}

export function buildContractorBookedSms(job: ContractorBookedJob, origin: string): string {
  return `Trades on Demand booked you on ${contractorBookedSnippet(job)}. Open ${contractorJobUrl(origin, job.id)}`;
}

export function validatePushSubscription(input: {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
  userAgent?: unknown;
}): { ok: true; data: PushSubscriptionInput } | { ok: false; message: string } {
  const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) {
    return { ok: false, message: "Push subscription endpoint is invalid." };
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") {
      return { ok: false, message: "Push subscription endpoint is invalid." };
    }
  } catch {
    return { ok: false, message: "Push subscription endpoint is invalid." };
  }

  const p256dh = typeof input.keys?.p256dh === "string" ? input.keys.p256dh.trim() : "";
  const auth = typeof input.keys?.auth === "string" ? input.keys.auth.trim() : "";
  if (!p256dh || !auth || p256dh.length > 256 || auth.length > 128) {
    return { ok: false, message: "Push subscription keys are invalid." };
  }

  const userAgent =
    typeof input.userAgent === "string" ? input.userAgent.trim().slice(0, 300) || null : null;

  return { ok: true, data: { endpoint, p256dh, auth, userAgent } };
}

export function shouldSendBookedSmsFallback(input: {
  pushDelivered: number;
}): boolean {
  return input.pushDelivered === 0;
}

export function isMissingPushSubscriptionTable(error: unknown): boolean {
  if (!isSchemaMismatchError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /ContractorPushSubscription/i.test(message);
}

export function isGonePushStatus(status: number): boolean {
  return status === 404 || status === 410;
}
