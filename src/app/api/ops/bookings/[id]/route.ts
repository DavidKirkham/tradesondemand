import { NextResponse } from "next/server";
import { isBookingStatus } from "@/lib/booking";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to the ops board." }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string; note?: string };
  try {
    body = (await request.json()) as { status?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const status = String(body.status ?? "");
  if (!isBookingStatus(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const note = body.note?.trim() || null;

  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status,
        events: { create: { status, note } },
      },
    });
    return NextResponse.json({ booking });
  } catch {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
}
