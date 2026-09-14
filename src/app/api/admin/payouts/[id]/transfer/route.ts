import { NextResponse } from "next/server";
import { executePayoutTransfer } from "@/lib/contractor-connect";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prismaFailureResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const result = await executePayoutTransfer(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ payout: result.payout });
  } catch (error) {
    return prismaFailureResponse(error, "Could not transfer shop earnings.");
  }
}
