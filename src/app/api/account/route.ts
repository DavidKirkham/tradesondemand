import { NextResponse } from "next/server";
import { validateCustomerPatch } from "@/lib/customer";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await getCustomerFromCookie();
  if (!customer) {
    return NextResponse.json({ error: "Sign in with the email and phone from your booking." }, { status: 401 });
  }
  return NextResponse.json({ customer: { name: customer.name, email: customer.email, phone: customer.phone, preferredContact: customer.preferredContact } });
}

export async function PATCH(request: Request) {
  const customer = await getCustomerFromCookie();
  if (!customer) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  let body: { name?: string; phone?: string; preferredContact?: string };
  try {
    body = (await request.json()) as { name?: string; phone?: string; preferredContact?: string };
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }
  const parsed = validateCustomerPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.phone ? { phone: parsed.phone } : {}),
      ...(parsed.preferredContact ? { preferredContact: parsed.preferredContact } : {}),
    },
  });
  return NextResponse.json({
    customer: {
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      preferredContact: updated.preferredContact,
    },
  });
}
