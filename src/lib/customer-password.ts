import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { isValidEmail, isValidUsPhone } from "./phone";

export const CUSTOMER_PASSWORD_MIN = 10;
export const CUSTOMER_BCRYPT_ROUNDS = 10;
export const CUSTOMER_RESET_MINUTES = 15;

/** Valid bcrypt hash used only to keep failed-login timing closer to a real compare. */
const DUMMY_PASSWORD_HASH = "$2b$10$kMKsY0mglUUMCVNwCEZbrOesDvxmkMf7q9mk0r0iv79jnw67aKC1.";

export function validateCustomerPassword(
  password: string,
): { ok: true } | { ok: false; message: string } {
  if (password.length < CUSTOMER_PASSWORD_MIN) {
    return { ok: false, message: `Use at least ${CUSTOMER_PASSWORD_MIN} characters.` };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password is too long." };
  }
  if (!password.trim()) {
    return { ok: false, message: "Enter a password." };
  }
  return { ok: true };
}

export async function hashCustomerPassword(password: string): Promise<string> {
  return bcrypt.hash(password, CUSTOMER_BCRYPT_ROUNDS);
}

export async function customerPasswordMatches(password: string, hash: string | null): Promise<boolean> {
  const candidate = hash && hash.length > 0 ? hash : DUMMY_PASSWORD_HASH;
  try {
    return await bcrypt.compare(password, candidate);
  } catch {
    return false;
  }
}

export type CustomerAuthDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function customerPasswordLoginDecision(input: {
  customer: { passwordHash: string | null } | null;
  passwordOk: boolean;
}): CustomerAuthDecision {
  if (!input.customer) {
    return { ok: false, status: 401, error: "Sign-in failed." };
  }
  if (!input.customer.passwordHash) {
    return {
      ok: false,
      status: 409,
      error:
        "Set a password first. Use the email and phone on your booking, or the link from your confirmation.",
    };
  }
  if (!input.passwordOk) {
    return { ok: false, status: 401, error: "Sign-in failed." };
  }
  return { ok: true };
}

export function customerMagicLinkIntent(
  customer: { passwordHash: string | null } | null,
): "setup" | "signin" | "reject" {
  if (!customer) return "reject";
  return customer.passwordHash ? "signin" : "setup";
}

export function canBootstrapCustomerPassword(customer: { passwordHash: string | null }): boolean {
  return !customer.passwordHash;
}

export function createCustomerResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCustomerResetCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function customerResetCodeMatches(code: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashCustomerResetCode(code), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function customerResetCodeIsFresh(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() > now.getTime();
}

export function customerResetExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + CUSTOMER_RESET_MINUTES * 60 * 1000);
}

export function buildCustomerResetSms(code: string): string {
  return `Trades on Demand: your account code is ${code}. It expires in ${CUSTOMER_RESET_MINUTES} minutes. Call (816) 516-0735 if you did not ask for this.`;
}

export type CustomerRegisterInput = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
};

export function validateCustomerRegister(
  input: CustomerRegisterInput,
):
  | { ok: true; name: string; email: string; phone: string; password: string }
  | { ok: false; message: string } {
  const name = String(input.name ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Enter a name we can put on the ticket." };
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, message: "Enter a working email address." };
  const phoneRaw = String(input.phone ?? "");
  if (!isValidUsPhone(phoneRaw)) return { ok: false, message: "Enter a 10-digit U.S. phone number." };
  const password = String(input.password ?? "");
  const confirm = String(input.confirm ?? password);
  const policy = validateCustomerPassword(password);
  if (!policy.ok) return policy;
  if (password !== confirm) return { ok: false, message: "Passwords do not match." };
  return { ok: true, name, email, phone: phoneRaw.replace(/\D/g, "").slice(-10), password };
}

export function customerExistsRegisterMessage(hasPassword: boolean): string {
  return hasPassword
    ? "An account with that email already exists. Sign in."
    : "This email already has KC jobs. Claim your profile with the phone on the booking.";
}
