import { formatPhone, getDispatchPhone, toE164Us } from "./phone";

export type SmsSendStatus = "SENT" | "SKIPPED" | "FAILED";

export type SmsResult = {
  status: SmsSendStatus;
  error?: string;
};

export function isTwilioConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      env.TWILIO_FROM_NUMBER?.trim(),
  );
}

export function buildAcceptEtaSms(input: {
  businessName: string;
  publicId: string;
  eta: string;
}): string {
  const eta = input.eta.trim();
  return `${input.businessName} accepted your Trades on Demand job ${input.publicId}. They said: ${eta} Call ${formatPhone(getDispatchPhone())} if you need the KC desk.`;
}

export async function sendCustomerSms(to: string, body: string): Promise<SmsResult> {
  if (!isTwilioConfigured()) {
    return { status: "SKIPPED", error: "Twilio is not configured on this server." };
  }

  const dest = toE164Us(to);
  const from = toE164Us(process.env.TWILIO_FROM_NUMBER ?? "") ?? process.env.TWILIO_FROM_NUMBER?.trim();
  if (!dest || !from) {
    return { status: "FAILED", error: "Customer or Twilio from-number is not a valid US phone." };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const params = new URLSearchParams({ To: dest, From: from, Body: body });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!response.ok) {
      return { status: "FAILED", error: `Twilio HTTP ${response.status}` };
    }
    return { status: "SENT" };
  } catch {
    return { status: "FAILED", error: "Could not reach Twilio." };
  }
}
