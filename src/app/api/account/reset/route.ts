import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { validateAccountLookup } from "@/lib/customer";
import { customerCookieOptions, issueCustomerSession } from "@/lib/customer-auth";
import {
  customerResetCodeIsFresh,
  customerResetCodeMatches,
  hashCustomerPassword,
  validateCustomerPassword,
} from "@/lib/customer-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; phone?: string; code?: string; password?: string; confirm?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const parsed = validateAccountLookup(String(body.email ?? ""), String(body.phone ?? ""));
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const code = String(body.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code we texted." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? password);
  const policy = validateCustomerPassword(password);
  if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { email: parsed.email, phone: parsed.phone },
    });
    if (
      !customer ||
      !customerResetCodeIsFresh(customer.resetCodeExpiresAt) ||
      !customerResetCodeMatches(code, customer.resetCodeHash)
    ) {
      return NextResponse.json({ error: "That reset code is invalid or expired." }, { status: 401 });
    }

    const passwordHash = await hashCustomerPassword(password);
    const sessionToken = await issueCustomerSession(customer.id, {
      passwordHash,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    });
    const response = NextResponse.json({ ok: true });
    const cookie = customerCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not reset that password. Try again.");
  }
}
