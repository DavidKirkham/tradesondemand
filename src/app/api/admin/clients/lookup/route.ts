import { NextResponse } from "next/server";
import { lookupAdminIntakeClient } from "@/lib/admin-intake-action";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone") ?? "";
  const email = url.searchParams.get("email") ?? "";
  if (!phone.trim() && !email.trim()) {
    return NextResponse.json({ error: "Enter a phone or email to look up." }, { status: 400 });
  }

  try {
    const match = await lookupAdminIntakeClient({ phone, email });
    return NextResponse.json({ match });
  } catch (error) {
    return prismaFailureResponse(error, "Could not look up that client.");
  }
}
