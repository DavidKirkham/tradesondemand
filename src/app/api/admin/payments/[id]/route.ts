import { NextResponse } from "next/server";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { isPaymentStatus } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { markInvoicePaidForPayment } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }
  const { id } = await params;
  let body: { status?: string; note?: string };
  try {
    body = (await request.json()) as { status?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }
  const status = String(body.status ?? "");
  if (!isPaymentStatus(status)) {
    return NextResponse.json({ error: "Use pending, paid, or refunded." }, { status: 400 });
  }
  try {
    const payment = await prisma.payment.update({
      where: { id },
      data: { status, note: body.note?.trim() || undefined },
    });
    if (status === "PAID") {
      await markInvoicePaidForPayment(payment.id);
    }
    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
}
