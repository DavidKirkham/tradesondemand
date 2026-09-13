import { formatUsd } from "./money";
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

type TwilioRequestAuth = {
  accountSid: string;
  username: string;
  password: string;
};

function twilioApiKeyAuth(env: Record<string, string | undefined>): { username: string; password: string } | null {
  const username = env.TWILIO_API_KEY_SID?.trim() ?? "";
  const password = env.TWILIO_API_KEY_SECRET?.trim() ?? "";
  if (!username || !password) return null;
  return { username, password };
}

function twilioAuthTokenAuth(env: Record<string, string | undefined>): { username: string; password: string } | null {
  const username = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const password = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!username || !password) return null;
  return { username, password };
}

/** Account SID stays in the Messages URL. API Key SID+secret win for Basic auth when both are set. */
export function getTwilioRequestAuth(
  env: Record<string, string | undefined> = process.env,
): TwilioRequestAuth | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  if (!accountSid || !env.TWILIO_FROM_NUMBER?.trim()) return null;
  const credentials = twilioApiKeyAuth(env) ?? twilioAuthTokenAuth(env);
  if (!credentials) return null;
  return { accountSid, ...credentials };
}

export function isTwilioConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const from = Boolean(env.TWILIO_FROM_NUMBER?.trim());
  const apiKey = Boolean(env.TWILIO_API_KEY_SID?.trim() && env.TWILIO_API_KEY_SECRET?.trim());
  const authToken = Boolean(env.TWILIO_ACCOUNT_SID?.trim() && env.TWILIO_AUTH_TOKEN?.trim());
  return from && (apiKey || authToken);
}

export function buildAcceptEtaSms(input: {
  businessName: string;
  publicId: string;
  eta: string;
}): string {
  const eta = input.eta.trim();
  return `${input.businessName} accepted your Trades on Demand job ${input.publicId}. They said: ${eta} Call ${formatPhone(getDispatchPhone())} if you need the KC desk.`;
}

export function buildContractorPasswordResetSms(input: {
  code: string;
  resetUrl: string;
}): string {
  return `Trades on Demand password reset code: ${input.code}. Or open ${input.resetUrl} Expires in 20 min. Ignore if you did not ask.`;
}

export function buildInvoiceSms(input: {
  businessName: string;
  publicId: string;
  amountDueCents: number;
  payUrl: string;
}): string {
  const due =
    input.amountDueCents > 0
      ? `Balance due to TOD: ${formatUsd(input.amountDueCents)}. View and pay: ${input.payUrl}`
      : `The deposit already covers the work. View the invoice: ${input.payUrl}`;
  return `${input.businessName} sent a Trades on Demand invoice for job ${input.publicId}. ${due} Call ${formatPhone(getDispatchPhone())} if you need the KC desk.`;
}

export function describeInvoiceSms(sms: ContractorEtaSmsPayload): string {
  const persist = sms.persistSkipped
    ? " SMS status was not stored (database is missing SMS columns)."
    : "";
  if (sms.status === "SENT") {
    return `Invoice saved. Customer texted with a link to pay TOD.${persist}`;
  }
  const reason = sms.error?.trim() || "No further detail.";
  if (sms.status === "SKIPPED") {
    return `Invoice saved. SMS skipped: ${reason}${persist}`;
  }
  if (sms.status === "FAILED") {
    return `Invoice saved. SMS did not send: ${reason}${persist}`;
  }
  return `Invoice saved.${persist}`;
}

export function buildContractorCustomerSms(input: {
  businessName: string;
  publicId: string;
  message: string;
}): string {
  const message = input.message.trim();
  return `${input.businessName} (Trades on Demand job ${input.publicId}): ${message} Call ${formatPhone(getDispatchPhone())} if you need the KC desk.`;
}

export function describeContractorCustomerSms(sms: ContractorEtaSmsPayload): string {
  const persist = sms.persistSkipped
    ? " SMS status was not stored (database is missing SMS columns)."
    : "";
  if (sms.status === "SENT") {
    return `Client texted.${persist}`;
  }
  const reason = sms.error?.trim() || "No further detail.";
  if (sms.status === "SKIPPED") {
    return `Note saved. SMS skipped: ${reason}${persist}`;
  }
  if (sms.status === "FAILED") {
    return `Note saved. SMS did not send: ${reason}${persist}`;
  }
  return `Note saved.${persist}`;
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

  const auth = getTwilioRequestAuth();
  if (!auth) {
    return { status: "SKIPPED", error: "Twilio Account SID is required for the Messages API path." };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(auth.accountSid)}/Messages.json`;
  const params = new URLSearchParams({ To: dest, From: from, Body: body });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
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
