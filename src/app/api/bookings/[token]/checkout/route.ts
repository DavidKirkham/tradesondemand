import { NextResponse } from "next/server";
import { createPlatformCheckoutSession } from "@/lib/stripe-checkout";
import {
  isStripeCheckoutConfigured,
  logStripeMissingKeys,
  STRIPE_CHECKOUT_UNAVAILABLE_CUSTOMER_MESSAGE,
} from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ token }, { publicId: token }] },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const payment = booking.payments.find((row) => row.status === "PENDING" && row.amountCents > 0);
  if (!payment) {
    return NextResponse.json({ error: "No pending TOD deposit on this booking." }, { status: 400 });
  }

  if (!isStripeCheckoutConfigured()) {
    logStripeMissingKeys("booking checkout retry");
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
    customerId: booking.customerId,
    customerEmail: booking.customerEmail,
    amountCents: payment.amountCents,
    paymentType: payment.type === "BALANCE" ? "balance" : "deposit",
    description: payment.note || "TOD deposit",
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
