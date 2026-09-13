import webpush from "web-push";
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  isGonePushStatus,
  isWebPushConfigured,
  type PushSubscriptionInput,
} from "./contractor-push";

export type WebPushSendResult =
  | { ok: true }
  | { ok: false; gone?: boolean; error: string };

export async function sendWebPushToSubscription(
  subscription: PushSubscriptionInput,
  payload: unknown,
  env: Record<string, string | undefined> = process.env,
): Promise<WebPushSendResult> {
  if (!isWebPushConfigured(env)) {
    return { ok: false, error: "Web Push is not configured (missing VAPID keys)." };
  }

  try {
    webpush.setVapidDetails(getVapidSubject(env), getVapidPublicKey(env), getVapidPrivateKey(env));
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const status = webPushStatusCode(error);
    if (status !== null && isGonePushStatus(status)) {
      return { ok: false, gone: true, error: `Push subscription gone (${status}).` };
    }
    return { ok: false, error: webPushErrorMessage(error) };
  }
}

function webPushStatusCode(error: unknown): number | null {
  if (error && typeof error === "object" && "statusCode" in error) {
    const status = (error as { statusCode?: unknown }).statusCode;
    return typeof status === "number" ? status : null;
  }
  return null;
}

function webPushErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Web Push send failed.";
}
