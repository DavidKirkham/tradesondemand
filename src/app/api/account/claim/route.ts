import { NextResponse } from "next/server";
import { customerMagicLinkIntent } from "@/lib/customer-password";
import { customerSetupCookieOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const customer = token ? await prisma.customer.findUnique({ where: { token } }) : null;
  const intent = customerMagicLinkIntent(customer ? { passwordHash: customer.passwordHash } : null);

  if (intent === "setup" && customer) {
    const destination = new URL("/account/login?setup=1", request.url);
    const response = NextResponse.redirect(destination);
    const cookie = customerSetupCookieOptions(customer.token);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  }

  const destination = new URL(
    intent === "signin" ? "/account/login?notice=password" : "/account/login",
    request.url,
  );
  return NextResponse.redirect(destination);
}
