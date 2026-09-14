import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createCustomerToken } from "./customer";
import {
  CUSTOMER_LEGACY_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SETUP_COOKIE,
  customerLoginHref,
} from "./customer-paths";
import { prisma } from "./prisma";

export function customerCookieOptions(sessionToken: string) {
  return {
    name: CUSTOMER_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  };
}

export function customerSetupCookieOptions(token: string) {
  return {
    name: CUSTOMER_SETUP_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
  };
}

/** Pre-password cookie that stored Customer.token. Read-only fallback until a password is set. */
export function customerLegacyCookieOptions(token: string) {
  return {
    name: CUSTOMER_LEGACY_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  };
}

export function clearCustomerCookieOptions() {
  return {
    name: CUSTOMER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function clearCustomerSetupCookieOptions() {
  return {
    name: CUSTOMER_SETUP_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function clearCustomerLegacyCookieOptions() {
  return {
    name: CUSTOMER_LEGACY_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export async function getCustomerFromCookie() {
  const jar = await cookies();
  const session = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (session) {
    const customer = await prisma.customer.findUnique({ where: { sessionToken: session } });
    if (customer) return customer;
  }

  const legacy = jar.get(CUSTOMER_LEGACY_COOKIE)?.value;
  if (legacy) {
    const customer = await prisma.customer.findUnique({ where: { token: legacy } });
    // After a password exists, the old magic-token cookie is no longer enough.
    if (customer && !customer.passwordHash) return customer;
  }

  return null;
}

export async function getCustomerFromSetupCookie() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SETUP_COOKIE)?.value;
  if (!token) return null;
  const customer = await prisma.customer.findUnique({ where: { token } });
  if (!customer || customer.passwordHash) return null;
  return customer;
}

export async function requireCustomer(nextPath?: string) {
  const customer = await getCustomerFromCookie();
  if (!customer) {
    redirect(customerLoginHref(nextPath));
  }
  return customer;
}

export async function issueCustomerSession(
  customerId: string,
  extra?: { passwordHash?: string | null; resetCodeHash?: string | null; resetCodeExpiresAt?: Date | null },
) {
  const sessionToken = createCustomerToken();
  await prisma.customer.update({
    where: { id: customerId },
    data: { sessionToken, ...extra },
  });
  return sessionToken;
}

export async function attachOrphanBookings(customerId: string, email: string) {
  const bookings = await prisma.booking.findMany({
    where: { customerEmail: email, customerId: null },
    select: { id: true },
  });
  if (bookings.length === 0) return 0;
  const ids = bookings.map((booking) => booking.id);
  await prisma.booking.updateMany({
    where: { id: { in: ids } },
    data: { customerId },
  });
  await prisma.payment.updateMany({
    where: { bookingId: { in: ids }, customerId: null },
    data: { customerId },
  });
  return bookings.length;
}
