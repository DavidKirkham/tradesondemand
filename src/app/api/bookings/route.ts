import { NextResponse } from "next/server";
import { createPublicId, createToken, validateBookingInput, type BookingInput } from "@/lib/booking";
import { parseTradeRatesJson, parseTradesJson } from "@/lib/contractor";
import { createCustomerToken, createPaymentPublicId } from "@/lib/customer";
import { customerCookieOptions, issueCustomerSession } from "@/lib/customer-auth";
import { depositForBooking } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { isStripeCheckoutConfigured, logStripeMissingKeys } from "@/lib/stripe";
import { createPlatformCheckoutSession } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Partial<BookingInput>;
  try {
    body = (await request.json()) as Partial<BookingInput>;
  } catch {
    return NextResponse.json({ error: "Send a JSON booking payload." }, { status: 400 });
  }

  const parsed = validateBookingInput({
    trade: String(body.trade ?? ""),
    problem: String(body.problem ?? ""),
    urgency: String(body.urgency ?? ""),
    street: String(body.street ?? ""),
    city: String(body.city ?? ""),
    state: String(body.state ?? ""),
    zip: String(body.zip ?? ""),
    customerName: String(body.customerName ?? ""),
    customerPhone: String(body.customerPhone ?? ""),
    customerEmail: String(body.customerEmail ?? ""),
    contractorId: body.contractorId ? String(body.contractorId) : "",
    matchPreference: body.matchPreference ? String(body.matchPreference) : "",
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message, field: parsed.field }, { status: 400 });
  }

  let contractorId: string | null = null;
  let contractorForDeposit: Parameters<typeof depositForBooking>[0]["contractor"] = null;
  if (parsed.data.matchPreference === "SPECIFIC" && parsed.data.contractorId) {
    const contractor = await prisma.contractor.findUnique({
      where: { id: parsed.data.contractorId },
    });
    if (!contractor || contractor.status !== "APPROVED") {
      return NextResponse.json(
        { error: "That contractor is not available yet. Choose first available or another licensed pro." },
        { status: 400 },
      );
    }
    if (!parseTradesJson(contractor.tradesJson).includes(parsed.data.trade)) {
      return NextResponse.json(
        { error: "That contractor does not offer this trade. Pick another or let us match you." },
        { status: 400 },
      );
    }
    contractorId = contractor.id;
    contractorForDeposit = {
      hourlyRateCents: contractor.hourlyRateCents,
      minimumChargeCents: contractor.minimumChargeCents,
      emergencyRateCents: contractor.emergencyRateCents,
      tradeRates: parseTradeRatesJson(contractor.tradeRatesJson),
    };
  }

  const deposit = depositForBooking({
    urgency: parsed.data.urgency,
    trade: parsed.data.trade,
    contractor: contractorForDeposit,
  });

  const customer = await prisma.customer.upsert({
    where: { email: parsed.data.customerEmail },
    update: {
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
    },
    create: {
      email: parsed.data.customerEmail,
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
      token: createCustomerToken(),
    },
  });

  const booking = await prisma.booking.create({
    data: {
      trade: parsed.data.trade,
      problem: parsed.data.problem,
      urgency: parsed.data.urgency,
      street: parsed.data.street,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail,
      quoteSummary: `${parsed.data.quoteSummary} · ${deposit.summary}`,
      contractorId,
      customerId: customer.id,
      matchPreference: contractorId ? "SPECIFIC" : "FIRST_AVAILABLE",
      publicId: createPublicId(),
      token: createToken(),
      events: {
        create: {
          status: "RECEIVED",
          note: parsed.data.urgency === "emergency" ? "Emergency ticket opened" : "Routine ticket opened",
        },
      },
      payments: {
        create: {
          publicId: createPaymentPublicId(),
          customerId: customer.id,
          amountCents: deposit.amountCents,
          type: "DEPOSIT",
          status: deposit.amountCents === 0 ? "PAID" : "PENDING",
          note:
            deposit.amountCents === 0
              ? "No trip deposit. Future job balance is paid to Trades on Demand (Trademark Walls), not the contractor."
              : "Pending Stripe Checkout — you pay Trades on Demand, not the contractor.",
        },
      },
    },
    include: { payments: true },
  });

  const payment = booking.payments[0];
  let checkoutUrl: string | null = null;
  const stripeConfigured = isStripeCheckoutConfigured();

  if (deposit.amountCents > 0 && stripeConfigured) {
    const session = await createPlatformCheckoutSession({
      request,
      bookingId: booking.id,
      bookingPublicId: booking.publicId,
      bookingToken: booking.token,
      customerId: customer.id,
      customerEmail: customer.email,
      amountCents: deposit.amountCents,
      paymentType: deposit.checkoutKind,
      description: deposit.summary,
    });
    if ("url" in session) {
      checkoutUrl = session.url;
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { stripeCheckoutSessionId: session.sessionId },
        });
      }
    } else {
      console.warn(`[stripe] booking checkout failed: ${session.error}`);
    }
  } else if (deposit.amountCents > 0 && !stripeConfigured) {
    logStripeMissingKeys("booking created without Checkout");
  }

  const sessionToken = await issueCustomerSession(customer.id);
  const response = NextResponse.json({
    publicId: booking.publicId,
    token: booking.token,
    status: booking.status,
    customerToken: customer.token,
    deposit,
    checkoutUrl,
    stripeConfigured,
    paymentStatus: payment?.status ?? (deposit.amountCents === 0 ? "PAID" : "PENDING"),
  });
  const cookie = customerCookieOptions(sessionToken);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
