import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { validateAccountLookup } from "@/lib/customer";
import {
  buildCustomerResetSms,
  createCustomerResetCode,
  customerResetExpiresAt,
  hashCustomerResetCode,
} from "@/lib/customer-password";
import { prisma } from "@/lib/prisma";
import { sendCustomerSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const GENERIC = "If that profile exists, we texted a reset code.";

export async function POST(request: Request) {
  let body: { email?: string; phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const parsed = validateAccountLookup(String(body.email ?? ""), String(body.phone ?? ""));
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  try {
    const customer = await prisma.customer.findFirst({
      where: { email: parsed.email, phone: parsed.phone },
    });
    if (!customer) {
      return NextResponse.json({ ok: true, message: GENERIC });
    }

    const code = createCustomerResetCode();
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        resetCodeHash: hashCustomerResetCode(code),
        resetCodeExpiresAt: customerResetExpiresAt(),
      },
    });

    const sms = await sendCustomerSms(customer.phone, buildCustomerResetSms(code));
    if (sms.status === "FAILED") {
      return NextResponse.json(
        { error: "We could not text that number. Try again or call the KC desk." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: GENERIC,
      delivered: sms.status === "SENT",
    });
  } catch (error) {
    return prismaFailureResponse(error, "Could not start a password reset. Try again.");
  }
}
