import { NextResponse } from "next/server";
import { validateAccountLookup } from "@/lib/customer";
import { customerCookieOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let body: { email?: string; phone?: string };
  try {
    body = (await request.json()) as { email?: string; phone?: string };
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }
  const parsed = validateAccountLookup(String(body.email ?? ""), String(body.phone ?? ""));
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const customer = await prisma.customer.findFirst({
    where: { email: parsed.email, phone: parsed.phone },
  });
  if (!customer) {
    return NextResponse.json(
      { error: "No private profile matches that email and phone. Book a job first." },
      { status: 404 },
    );
  }
  const response = NextResponse.json({ ok: true });
  const cookie = customerCookieOptions(customer.token);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
