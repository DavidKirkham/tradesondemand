import { NextResponse } from "next/server";
import { validateAccountLookup } from "@/lib/customer";
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
      { error: "No private profile matches that email and phone. Book a job first, or create an account." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    needsPassword: !customer.passwordHash,
    message: customer.passwordHash
      ? "This profile already has a password. Sign in, or reset it from the login page."
      : "Claim this profile by choosing a password.",
  });
}
