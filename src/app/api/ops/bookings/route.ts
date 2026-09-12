import { NextResponse } from "next/server";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to the ops board." }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bookings });
}
