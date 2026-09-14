import { NextResponse } from "next/server";
import {
  clearContractorCookieOptions,
  clearContractorSetupCookieOptions,
  getApprovedContractorFromCookie,
} from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const contractor = await getApprovedContractorFromCookie();
  if (contractor) {
    await prisma.contractor.update({
      where: { id: contractor.id },
      data: { sessionToken: null },
    });
  }
  const response = NextResponse.json({ ok: true });
  const session = clearContractorCookieOptions();
  const setup = clearContractorSetupCookieOptions();
  response.cookies.set(session.name, session.value, session);
  response.cookies.set(setup.name, setup.value, setup);
  return response;
}
