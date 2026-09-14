import { NextResponse } from "next/server";
import {
  createContractorExpressLoginLink,
  refreshContractorConnectFromStripe,
  startContractorConnectOnboarding,
} from "@/lib/contractor-connect";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isMissingContractorPayoutModel } from "@/lib/contractor-payouts";

export const dynamic = "force-dynamic";

export async function GET() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }
  try {
    const latest = (await refreshContractorConnectFromStripe(contractor.id)) ?? contractor;
    return NextResponse.json({
      accountId: latest.stripeConnectAccountId,
      onboarded: latest.stripeConnectOnboarded,
      payoutsEnabled: latest.stripeConnectPayoutsEnabled,
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) {
      return prismaFailureResponse(error, "Could not load payout status.");
    }
    return prismaFailureResponse(error, "Could not load payout status.");
  }
}

export async function POST(request: Request) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    body = {};
  }
  const action = body.action === "dashboard" ? "dashboard" : "onboard";

  try {
    if (action === "dashboard") {
      if (!contractor.stripeConnectAccountId || !contractor.stripeConnectOnboarded) {
        return NextResponse.json({ error: "Finish Stripe onboarding first." }, { status: 409 });
      }
      const result = await createContractorExpressLoginLink(contractor.stripeConnectAccountId);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ url: result.url });
    }

    const result = await startContractorConnectOnboarding({ request, contractor });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ url: result.url });
  } catch (error) {
    return prismaFailureResponse(error, "Could not start Stripe onboarding.");
  }
}
