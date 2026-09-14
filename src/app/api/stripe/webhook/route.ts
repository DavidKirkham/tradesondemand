import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  applyConnectAccountUpdated,
  applyTransferFailed,
  applyTransferUpdated,
} from "@/lib/contractor-connect";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { applyCheckoutSessionPaid, applyPaymentIntentPaid } from "@/lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await applyCheckoutSessionPaid(event.data.object);
    }
    if (event.type === "payment_intent.succeeded") {
      await applyPaymentIntentPaid(event.data.object);
    }
    const type = event.type as string;
    if (type === "account.updated" || type === "v2.core.account.updated") {
      const object = event.data.object as { id?: string };
      await applyConnectAccountUpdated(object);
    }
    if (type === "transfer.created" || type === "transfer.updated") {
      await applyTransferUpdated(event.data.object as Stripe.Transfer);
    }
    if (type === "transfer.failed" || type === "transfer.reversed") {
      await applyTransferFailed(
        event.data.object as Stripe.Transfer,
        type === "transfer.reversed" ? "Transfer was reversed." : undefined,
      );
    }
  } catch (error) {
    console.error("Stripe webhook handler failed", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
