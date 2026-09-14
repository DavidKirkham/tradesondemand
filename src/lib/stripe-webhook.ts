import type Stripe from "stripe";
import { createPaymentPublicId } from "./customer";
import { ensureContractorPayoutsForPayment } from "./contractor-connect";
import { isMissingInvoiceModel } from "./invoice-columns";
import { prisma } from "./prisma";
import { sessionPaymentIntentId } from "./stripe-checkout";

export function paymentTypeFromMetadata(value: string | undefined): "DEPOSIT" | "BALANCE" {
  if (value === "balance") return "BALANCE";
  return "DEPOSIT";
}

export function checkoutPaymentWhere(input: {
  sessionId?: string | null;
  intentId?: string | null;
  bookingId?: string | null;
  paymentType?: string | null;
}): { OR: Array<Record<string, string>> } {
  const type = paymentTypeFromMetadata(input.paymentType ?? undefined);
  const or: Array<Record<string, string>> = [];
  if (input.sessionId) or.push({ stripeCheckoutSessionId: input.sessionId });
  if (input.intentId) or.push({ stripePaymentIntentId: input.intentId });
  if (input.bookingId) {
    or.push({ bookingId: input.bookingId, type, status: "PENDING" });
  }
  return { OR: or };
}

export async function markInvoicePaidForPayment(paymentId: string) {
  try {
    await prisma.invoice.updateMany({
      where: { paymentId, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date() },
    });
    await ensureContractorPayoutsForPayment(paymentId);
  } catch (error) {
    if (!isMissingInvoiceModel(error)) throw error;
  }
}

export async function applyCheckoutSessionPaid(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId || session.client_reference_id || "";
  const intentId = sessionPaymentIntentId(session);
  const paymentType = paymentTypeFromMetadata(session.metadata?.paymentType);
  const where = checkoutPaymentWhere({
    sessionId: session.id,
    intentId,
    bookingId,
    paymentType,
  });
  const existing = where.OR.length
    ? await prisma.payment.findFirst({
        where,
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (existing) {
    const payment = await prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: "PAID",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: intentId ?? existing.stripePaymentIntentId,
        note: "Paid to Trades on Demand via Stripe Checkout (Trademark Walls). Contractor is not the merchant of record.",
      },
    });
    await markInvoicePaidForPayment(payment.id);
    return payment;
  }

  if (!bookingId) return null;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return null;

  const payment = await prisma.payment.create({
    data: {
      publicId: createPaymentPublicId(),
      bookingId: booking.id,
      customerId: booking.customerId,
      amountCents: session.amount_total ?? 0,
      type: paymentType,
      status: "PAID",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: intentId,
      note: "Paid to Trades on Demand via Stripe Checkout (Trademark Walls).",
    },
  });
  await markInvoicePaidForPayment(payment.id);
  return payment;
}

export async function applyPaymentIntentPaid(intent: Stripe.PaymentIntent) {
  const bookingId = intent.metadata?.bookingId ?? "";
  const paymentType = paymentTypeFromMetadata(intent.metadata?.paymentType);
  const where = checkoutPaymentWhere({
    intentId: intent.id,
    bookingId,
    paymentType,
  });
  const existing = where.OR.length
    ? await prisma.payment.findFirst({
        where,
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (!existing) return null;
  const payment = await prisma.payment.update({
    where: { id: existing.id },
    data: {
      status: "PAID",
      stripePaymentIntentId: intent.id,
      note: "Paid to Trades on Demand via Stripe (Trademark Walls).",
    },
  });
  await markInvoicePaidForPayment(payment.id);
  return payment;
}
