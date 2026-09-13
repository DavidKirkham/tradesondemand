import { NextResponse } from "next/server";
import { assignBookingToApprovedContractor } from "@/lib/admin-assign-action";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const { id } = await params;
  let body: { contractorId?: string };
  try {
    body = (await request.json()) as { contractorId?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const contractorId = String(body.contractorId ?? "").trim();
  if (!contractorId) {
    return NextResponse.json({ error: "Pick an approved subcontractor." }, { status: 400 });
  }

  try {
    const result = await assignBookingToApprovedContractor(id, contractorId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ booking: result.booking });
  } catch (error) {
    return prismaFailureResponse(error, "Could not assign that job.");
  }
}
