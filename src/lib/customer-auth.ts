import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "tod_customer";

export function customerCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  };
}

export async function getCustomerFromCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return prisma.customer.findUnique({ where: { token } });
}
