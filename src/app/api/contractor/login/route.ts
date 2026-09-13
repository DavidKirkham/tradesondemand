import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { contractorCookieOptions, issueContractorSession } from "@/lib/contractor-auth";
import {
  contractorPasswordLoginDecision,
  contractorPasswordMatches,
  contractorWhereIdentifier,
  parseContractorIdentifier,
} from "@/lib/contractor-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { identifier?: string; email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const identifier = parseContractorIdentifier(String(body.identifier ?? body.email ?? ""));
  const password = String(body.password ?? "");
  if (!identifier || !password) {
    return NextResponse.json({ error: "Enter your shop email, phone, or ID and your password." }, { status: 400 });
  }

  try {
    const contractor = await prisma.contractor.findFirst({
      where: contractorWhereIdentifier(identifier),
    });
    const passwordOk = await contractorPasswordMatches(password, contractor?.passwordHash ?? null);
    const decision = contractorPasswordLoginDecision({
      contractor: contractor
        ? { status: contractor.status, passwordHash: contractor.passwordHash }
        : null,
      passwordOk,
    });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }
    if (!contractor) {
      return NextResponse.json({ error: "Sign-in failed." }, { status: 401 });
    }

    const sessionToken = await issueContractorSession(contractor.id);
    const response = NextResponse.json({ ok: true });
    const cookie = contractorCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not sign in. Try again.");
  }
}
