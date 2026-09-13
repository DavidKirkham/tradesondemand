import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import {
  clearCustomerSetupCookieOptions,
  customerCookieOptions,
  issueCustomerSession,
} from "@/lib/customer-auth";
import {
  customerPasswordLoginDecision,
  customerPasswordMatches,
} from "@/lib/customer-password";
import { isValidEmail } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!isValidEmail(email) || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { email } });
    const passwordOk = await customerPasswordMatches(password, customer?.passwordHash ?? null);
    const decision = customerPasswordLoginDecision({
      customer: customer ? { passwordHash: customer.passwordHash } : null,
      passwordOk,
    });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }
    if (!customer) {
      return NextResponse.json({ error: "Sign-in failed." }, { status: 401 });
    }

    const sessionToken = await issueCustomerSession(customer.id);
    const response = NextResponse.json({ ok: true });
    const cookie = customerCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    const setup = clearCustomerSetupCookieOptions();
    response.cookies.set(setup.name, setup.value, setup);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not sign in. Try again.");
  }
}
