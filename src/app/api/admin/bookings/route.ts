import { NextResponse } from "next/server";
import { createAdminPhoneJob } from "@/lib/admin-intake-action";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  try {
    const result = await createAdminPhoneJob({
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
      contractorId: String(body.contractorId ?? ""),
      notes: body.notes != null ? String(body.notes) : "",
      preferredTime: body.preferredTime != null ? String(body.preferredTime) : "",
      skipDeposit: Boolean(body.skipDeposit),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, field: result.field },
        { status: result.status },
      );
    }
    return NextResponse.json({
      booking: result.booking,
      customer: result.customer,
      assigned: result.assigned,
      assignError: result.assignError,
    });
  } catch (error) {
    return prismaFailureResponse(error, "Could not create that phone job.");
  }
}
