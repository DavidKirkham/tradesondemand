import bcrypt from "bcryptjs";
import { contractorLoginBlockReason } from "./contractor-app";
import { isValidEmail, isValidUsPhone, nationalUsDigits } from "./phone";

export const CONTRACTOR_PASSWORD_MIN = 10;
export const BCRYPT_ROUNDS = 10;

/** Valid bcrypt hash used only to keep failed-login timing closer to a real compare. */
const DUMMY_PASSWORD_HASH = "$2b$10$kMKsY0mglUUMCVNwCEZbrOesDvxmkMf7q9mk0r0iv79jnw67aKC1.";

export type ContractorIdentifier = {
  kind: "email" | "phone" | "publicId";
  value: string;
};

export function parseContractorIdentifier(raw: string): ContractorIdentifier | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^PRO-[A-Z0-9]+$/i.test(trimmed)) {
    return { kind: "publicId", value: trimmed.toUpperCase() };
  }
  if (isValidEmail(trimmed)) {
    return { kind: "email", value: trimmed.toLowerCase() };
  }
  if (isValidUsPhone(trimmed)) {
    return { kind: "phone", value: nationalUsDigits(trimmed) };
  }
  return null;
}

export function contractorWhereIdentifier(identifier: ContractorIdentifier) {
  if (identifier.kind === "email") return { email: identifier.value };
  if (identifier.kind === "phone") return { phone: identifier.value };
  return { publicId: identifier.value };
}

export function validateContractorPassword(
  password: string,
): { ok: true } | { ok: false; message: string } {
  if (password.length < CONTRACTOR_PASSWORD_MIN) {
    return { ok: false, message: `Use at least ${CONTRACTOR_PASSWORD_MIN} characters.` };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password is too long." };
  }
  if (!password.trim()) {
    return { ok: false, message: "Enter a password." };
  }
  return { ok: true };
}

export async function hashContractorPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function contractorPasswordMatches(password: string, hash: string | null): Promise<boolean> {
  const candidate = hash && hash.length > 0 ? hash : DUMMY_PASSWORD_HASH;
  try {
    return await bcrypt.compare(password, candidate);
  } catch {
    return false;
  }
}

export type ContractorAuthDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function contractorPasswordLoginDecision(input: {
  contractor: { status: string; passwordHash: string | null } | null;
  passwordOk: boolean;
}): ContractorAuthDecision {
  if (!input.contractor) {
    return { ok: false, status: 401, error: "Sign-in failed." };
  }
  const blocked = contractorLoginBlockReason(input.contractor.status);
  if (blocked) {
    return { ok: false, status: 403, error: blocked };
  }
  if (!input.contractor.passwordHash) {
    return {
      ok: false,
      status: 409,
      error:
        "Set a password first. Use the email and phone on your application, or the invite link from dispatch.",
    };
  }
  if (!input.passwordOk) {
    return { ok: false, status: 401, error: "Sign-in failed." };
  }
  return { ok: true };
}

export function magicLinkIntent(
  contractor: { status: string; passwordHash: string | null } | null,
): "setup" | "signin" | "reject" {
  if (!contractor) return "reject";
  if (contractorLoginBlockReason(contractor.status)) return "reject";
  return contractor.passwordHash ? "signin" : "setup";
}

export function canBootstrapContractorPassword(contractor: {
  status: string;
  passwordHash: string | null;
}): boolean {
  return contractorLoginBlockReason(contractor.status) === null && !contractor.passwordHash;
}
