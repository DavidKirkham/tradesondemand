import { NextResponse } from "next/server";
import { createPublicId, createToken, validateBookingInput, type BookingInput } from "@/lib/booking";
import { parseTradesJson } from "@/lib/contractor";
import { prisma } from "@/lib/prisma";

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
  }

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
      quoteSummary: parsed.data.quoteSummary,
      contractorId,
      matchPreference: contractorId ? "SPECIFIC" : "FIRST_AVAILABLE",
      publicId: createPublicId(),
      token: createToken(),
      events: {
        create: {
          status: "RECEIVED",
          note: parsed.data.urgency === "emergency" ? "Emergency ticket opened" : "Routine ticket opened",
        },
      },
    },
  });

  return NextResponse.json({
    publicId: booking.publicId,
    token: booking.token,
    status: booking.status,
  });
}
