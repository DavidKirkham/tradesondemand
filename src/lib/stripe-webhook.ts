import type Stripe from "stripe";
import { createPaymentPublicId } from "./customer";
import { prisma } from "./prisma";
import { sessionPaymentIntentId } from "./stripe-checkout";

function paymentTypeFromMetadata(value: string | undefined): string {
  if (value === "balance") return "BALANCE";
  return "DEPOSIT";
}

export async function applyCheckoutSessionPaid(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId || session.client_reference_id || "";
  const intentId = sessionPaymentIntentId(session);
  const existing = await prisma.payment.findFirst({
    where: {
      OR: [
        ...(session.id ? [{ stripeCheckoutSessionId: session.id }] : []),
        ...(bookingId ? [{ bookingId, type: "DEPOSIT" as const }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: "PAID",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: intentId ?? existing.stripePaymentIntentId,
        note: "Paid to Trades on Demand via Stripe Checkout (Trademark Walls). Contractor is not the merchant of record.",
      },
    });
  }

  if (!bookingId) return null;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return null;

  return prisma.payment.create({
    data: {
      publicId: createPaymentPublicId(),
      bookingId: booking.id,
      customerId: booking.customerId,
      amountCents: session.amount_total ?? 0,
      type: paymentTypeFromMetadata(session.metadata?.paymentType),
      status: "PAID",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: intentId,
      note: "Paid to Trades on Demand via Stripe Checkout (Trademark Walls).",
    },
  });
}

export async function applyPaymentIntentPaid(intent: Stripe.PaymentIntent) {
  const bookingId = intent.metadata?.bookingId ?? "";
  const existing = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripePaymentIntentId: intent.id },
        ...(bookingId ? [{ bookingId, type: "DEPOSIT" as const }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return null;
  return prisma.payment.update({
    where: { id: existing.id },
    data: {
      status: "PAID",
      stripePaymentIntentId: intent.id,
      note: "Paid to Trades on Demand via Stripe (Trademark Walls).",
    },
  });
}
