import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { createCustomerToken } from "@/lib/customer";
import { attachOrphanBookings, customerCookieOptions, issueCustomerSession } from "@/lib/customer-auth";
import {
  customerExistsRegisterMessage,
  hashCustomerPassword,
  validateCustomerRegister,
} from "@/lib/customer-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { name?: string; email?: string; phone?: string; password?: string; confirm?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const parsed = validateCustomerRegister(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  try {
    const existing = await prisma.customer.findUnique({ where: { email: parsed.email } });
    if (existing) {
      return NextResponse.json(
        { error: customerExistsRegisterMessage(Boolean(existing.passwordHash)) },
        { status: 409 },
      );
    }

    const passwordHash = await hashCustomerPassword(parsed.password);
    const customer = await prisma.customer.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        phone: parsed.phone,
        token: createCustomerToken(),
        passwordHash,
      },
    });
    await attachOrphanBookings(customer.id, customer.email);
    const sessionToken = await issueCustomerSession(customer.id);
    const response = NextResponse.json({ ok: true, created: true });
    const cookie = customerCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not create that account. Try again.");
  }
}
