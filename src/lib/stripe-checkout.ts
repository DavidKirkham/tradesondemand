import type Stripe from "stripe";
import { appOriginFromRequest, getStripe } from "./stripe";

export type CheckoutKind = "deposit" | "minimum" | "balance";

export async function createPlatformCheckoutSession(input: {
  request: Request;
  bookingId: string;
  bookingPublicId: string;
  bookingToken: string;
  customerId?: string | null;
  customerEmail: string;
  amountCents: number;
  paymentType: CheckoutKind;
  description: string;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Stripe Checkout is not configured." };
  }
  if (input.amountCents <= 0) {
    return { error: "No amount to charge." };
  }

  const origin = appOriginFromRequest(input.request);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    client_reference_id: input.bookingId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: {
            name: `Trades on Demand ${input.paymentType} · ${input.bookingPublicId}`,
            description: `${input.description} You pay Trades on Demand (Trademark Walls). Not the contractor.`,
          },
        },
      },
    ],
    success_url: `${origin}/book/success?token=${encodeURIComponent(input.bookingToken)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book/retry?token=${encodeURIComponent(input.bookingToken)}`,
    metadata: {
      bookingId: input.bookingId,
      customerId: input.customerId ?? "",
      paymentType: input.paymentType,
    },
    payment_intent_data: {
      metadata: {
        bookingId: input.bookingId,
        customerId: input.customerId ?? "",
        paymentType: input.paymentType,
      },
    },
  });

  if (!session.url) {
    return { error: "Stripe did not return a Checkout URL." };
  }

  return { url: session.url, sessionId: session.id };
}

export function sessionPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}
