import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const decoded = decodeURIComponent(token).trim();
  if (!decoded) {
    return NextResponse.json({ error: "Enter a job ID or status token." }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ token: decoded }, { publicId: decoded.toUpperCase() }, { publicId: decoded }],
    },
    select: { token: true, publicId: true, status: true },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "No KC job matches that ID. Check the confirmation email or call dispatch." },
      { status: 404 },
    );
  }

  return NextResponse.json(booking);
}
