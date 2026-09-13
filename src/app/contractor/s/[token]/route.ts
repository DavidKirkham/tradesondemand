import { NextResponse } from "next/server";
import { contractorLoginBlockReason } from "@/lib/contractor-app";
import { contractorCookieOptions } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const contractor = await prisma.contractor.findUnique({ where: { loginToken: token } });
  const loginUrl = new URL("/contractor", request.url);

  if (!contractor) {
    return NextResponse.redirect(loginUrl);
  }
  const blocked = contractorLoginBlockReason(contractor.status);
  if (blocked) {
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL("/contractor", request.url));
  const cookie = contractorCookieOptions(contractor.loginToken);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
