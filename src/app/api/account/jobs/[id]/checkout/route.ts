import { NextResponse } from "next/server";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { pickPayablePayment } from "@/lib/customer-jobs";
import { prisma } from "@/lib/prisma";
import {
  isStripeCheckoutConfigured,
  logStripeMissingKeys,
  STRIPE_CHECKOUT_UNAVAILABLE_CUSTOMER_MESSAGE,
} from "@/lib/stripe";
import { createPlatformCheckoutSession } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomerFromCookie();
  if (!customer) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findFirst({
    where: {
      customerId: customer.id,
      OR: [{ id }, { publicId: id }, { token: id }],
    },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  let paymentId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { paymentId?: string };
    paymentId = body.paymentId;
  } catch {
    paymentId = undefined;
  }

  const payment = pickPayablePayment(booking.payments, paymentId);
  if (!payment) {
    return NextResponse.json({ error: "Nothing is owed on this job right now." }, { status: 400 });
  }

  if (!isStripeCheckoutConfigured()) {
    logStripeMissingKeys("account checkout");
    return NextResponse.json(
      { error: STRIPE_CHECKOUT_UNAVAILABLE_CUSTOMER_MESSAGE, stripeConfigured: false },
      { status: 503 },
    );
  }

  const session = await createPlatformCheckoutSession({
    request,
    bookingId: booking.id,
    bookingPublicId: booking.publicId,
    bookingToken: booking.token,
    customerId: customer.id,
    customerEmail: customer.email,
    amountCents: payment.amountCents,
    paymentType: payment.type === "BALANCE" ? "balance" : "deposit",
    description: payment.note || "TOD payment",
    returnToPortal: true,
  });

  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 502 });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripeCheckoutSessionId: session.sessionId },
  });

  return NextResponse.json({ checkoutUrl: session.url, sessionId: session.sessionId });
}
