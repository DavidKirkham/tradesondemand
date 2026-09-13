import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createContractorLoginToken } from "./contractor";
import { contractorLoginBlockReason } from "./contractor-app";
import { hashContractorPassword } from "./contractor-password";

export const PASSWORD_RESET_TTL_MS = 20 * 60 * 1000;
export const PASSWORD_RESET_COOLDOWN_MS = 90 * 1000;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_IP_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_IP_MAX_REQUESTS = 8;
export const PASSWORD_RESET_CONFIRM_IP_MAX = 20;

export const PASSWORD_RESET_REQUEST_MESSAGE =
  "If that shop is approved, we sent a reset text to the phone on the application. It expires in 20 minutes.";

export const PASSWORD_RESET_INVALID_MESSAGE = "That reset code is invalid or expired.";

const requestHits = new Map<string, number[]>();
const confirmHits = new Map<string, number[]>();

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePasswordResetToken(): string {
  return createContractorLoginToken();
}

export function generatePasswordResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function hashPasswordResetCode(code: string): Promise<string> {
  return hashContractorPassword(code);
}

export function passwordResetSecretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function contractorPasswordResetEligibility(contractor: {
  status: string;
  passwordHash: string | null;
} | null): "send" | "ignore" {
  if (!contractor) return "ignore";
  if (contractorLoginBlockReason(contractor.status)) return "ignore";
  if (!contractor.passwordHash) return "ignore";
  return "send";
}

export function passwordResetOnCooldown(
  sentAt: Date | null | undefined,
  now = new Date(),
  cooldownMs = PASSWORD_RESET_COOLDOWN_MS,
): boolean {
  if (!sentAt) return false;
  return now.getTime() - sentAt.getTime() < cooldownMs;
}

export function passwordResetExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export type PasswordResetConfirmDecision =
  | { ok: true }
  | { ok: false; status: number; error: string; lock: boolean };

export function contractorPasswordResetConfirmDecision(input: {
  reset: { expiresAt: Date; attempts: number } | null;
  contractorStatus?: string | null;
  secretOk: boolean;
  now?: Date;
}): PasswordResetConfirmDecision {
  const fail = (lock = false): PasswordResetConfirmDecision => ({
    ok: false,
    status: 401,
    error: PASSWORD_RESET_INVALID_MESSAGE,
    lock,
  });

  if (!input.reset) return fail();
  if (input.contractorStatus && contractorLoginBlockReason(input.contractorStatus)) {
    return fail(true);
  }
  if (passwordResetExpired(input.reset.expiresAt, input.now)) return fail(true);
  if (input.reset.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) return fail(true);
  if (!input.secretOk) {
    return fail(input.reset.attempts + 1 >= PASSWORD_RESET_MAX_ATTEMPTS);
  }
  return { ok: true };
}

export function requestClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown";
}

function consumeIpWindow(
  store: Map<string, number[]>,
  ip: string,
  maxHits: number,
  now: number,
): boolean {
  const windowStart = now - PASSWORD_RESET_IP_WINDOW_MS;
  const hits = (store.get(ip) ?? []).filter((stamp) => stamp > windowStart);
  if (hits.length >= maxHits) {
    store.set(ip, hits);
    return false;
  }
  hits.push(now);
  store.set(ip, hits);
  return true;
}

export function passwordResetRequestIpAllowed(ip: string, now = Date.now()): boolean {
  return consumeIpWindow(requestHits, ip, PASSWORD_RESET_IP_MAX_REQUESTS, now);
}

export function passwordResetConfirmIpAllowed(ip: string, now = Date.now()): boolean {
  return consumeIpWindow(confirmHits, ip, PASSWORD_RESET_CONFIRM_IP_MAX, now);
}

export function resetPasswordResetIpLimitersForTests() {
  requestHits.clear();
  confirmHits.clear();
}

export function parsePasswordResetToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/contractor\/r\/([A-Za-z0-9_-]+)/);
  const token = fromUrl?.[1] ?? trimmed;
  if (token.length < 16 || token.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
}

export function parsePasswordResetCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}
