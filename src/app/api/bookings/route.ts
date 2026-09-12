import { NextResponse } from "next/server";
import { createPublicId, createToken, validateBookingInput, type BookingInput } from "@/lib/booking";
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
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message, field: parsed.field }, { status: 400 });
  }

  const booking = await prisma.booking.create({
    data: {
      ...parsed.data,
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
