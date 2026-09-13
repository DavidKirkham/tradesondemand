import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "tod_contractor";

export function contractorCookieOptions(loginToken: string) {
  return {
    name: COOKIE,
    value: loginToken,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  };
}

export function clearContractorCookieOptions() {
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

export async function getApprovedContractorFromCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const contractor = await prisma.contractor.findUnique({ where: { loginToken: token } });
  if (!contractor || contractor.status !== "APPROVED") return null;
  return contractor;
}
