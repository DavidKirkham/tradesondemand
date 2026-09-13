import { NextResponse } from "next/server";
import { contractorSetupCookieOptions } from "@/lib/contractor-auth";
import { magicLinkIntent } from "@/lib/contractor-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const contractor = await prisma.contractor.findUnique({ where: { loginToken: token } });
  const loginUrl = new URL("/contractor", request.url);
  const intent = magicLinkIntent(
    contractor ? { status: contractor.status, passwordHash: contractor.passwordHash } : null,
  );

  if (intent === "reject") {
    return NextResponse.redirect(loginUrl);
  }

  if (intent === "signin") {
    loginUrl.searchParams.set("notice", "password");
    return NextResponse.redirect(loginUrl);
  }

  loginUrl.searchParams.set("setup", "1");
  const response = NextResponse.redirect(loginUrl);
  const cookie = contractorSetupCookieOptions(contractor!.loginToken);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
