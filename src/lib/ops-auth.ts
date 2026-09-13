import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "tod_ops";

/** Admin /ops password. Prefer ADMIN_PASSWORD; fall back to OPS_PASSWORD. */
export function opsPassword(): string {
  const admin = process.env.ADMIN_PASSWORD?.trim();
  if (admin) return admin;
  const ops = process.env.OPS_PASSWORD?.trim();
  if (ops) return ops;
  return "dispatch";
}

export function opsSessionValue(): string {
  return createHash("sha256").update(`tod:${opsPassword()}`).digest("hex");
}

export function passwordMatches(candidate: string): boolean {
  const expected = Buffer.from(opsPassword());
  const given = Buffer.from(candidate);
  if (expected.length !== given.length) {
    return false;
  }
  return timingSafeEqual(expected, given);
}

export async function isOpsAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) return false;
  const expected = Buffer.from(opsSessionValue());
  const given = Buffer.from(value);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export const isAdminAuthenticated = isOpsAuthenticated;

export function opsCookieOptions() {
  return {
    name: COOKIE,
    value: opsSessionValue(),
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  };
}

export function clearOpsCookieOptions() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}
