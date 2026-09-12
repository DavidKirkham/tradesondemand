import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "tod_ops";

export function opsPassword(): string {
  return process.env.OPS_PASSWORD || "dispatch";
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
