import { formatPhone, getDispatchPhone, isReservedUsFictionPhone, toE164Us } from "./phone";

export type SmsSendStatus = "SENT" | "SKIPPED" | "FAILED";

export type SmsResult = {
  status: SmsSendStatus;
  error?: string;
};

export type ContractorEtaSmsPayload = {
  status: string;
  error?: string | null;
  persistSkipped?: boolean;
};

export function describeContractorEtaSms(sms: ContractorEtaSmsPayload): string {
  const persist = sms.persistSkipped
    ? " SMS status was not stored (database is missing SMS columns)."
    : "";
  if (sms.status === "SENT") {
    return `Client texted with your arrival note.${persist}`;
  }
  const reason = sms.error?.trim() || "No further detail.";
  if (sms.status === "SKIPPED") {
    return `Arrival note saved. SMS skipped: ${reason}${persist}`;
  }
  if (sms.status === "FAILED") {
    return `Arrival note saved. SMS did not send: ${reason}${persist}`;
  }
  return `Arrival note saved.${persist}`;
}

export function isTwilioConfigured(env: Record<string, string | undefined> = process.env): boolean {
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

  if (isReservedUsFictionPhone(to)) {
    return {
      status: "SKIPPED",
      error: "Customer number is a reserved 555 test number. Twilio will not deliver it.",
    };
  }

  const dest = toE164Us(to);
  const from = toE164Us(process.env.TWILIO_FROM_NUMBER ?? "") ?? process.env.TWILIO_FROM_NUMBER?.trim();
  if (!dest || !from) {
    return { status: "SKIPPED", error: "Customer or Twilio from-number is not a valid US phone." };
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
      return { status: "FAILED", error: await twilioErrorMessage(response) };
    }
    return { status: "SENT" };
  } catch {
    return { status: "FAILED", error: "Could not reach Twilio." };
  }
}

async function twilioErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; code?: number };
    if (payload.message?.trim()) return `Twilio: ${payload.message.trim()}`;
    if (payload.code) return `Twilio error ${payload.code}`;
  } catch {
    /* non-JSON body */
  }
  return `Twilio HTTP ${response.status}`;
}
