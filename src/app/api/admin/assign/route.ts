import { NextResponse } from "next/server";
import { assignBookingToApprovedContractor } from "@/lib/admin-assign-action";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  let body: { bookingId?: string; contractorId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const bookingId = String(body.bookingId ?? "").trim();
  const contractorId = String(body.contractorId ?? "").trim();
  if (!bookingId || !contractorId) {
    return NextResponse.json({ error: "Pick a job and an approved subcontractor." }, { status: 400 });
  }

  const result = await assignBookingToApprovedContractor(bookingId, contractorId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ booking: result.booking });
}
