import { NextResponse } from "next/server";
import { customerCookieOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const customer = token ? await prisma.customer.findUnique({ where: { token } }) : null;
  const destination = new URL("/account", request.url);
  const response = NextResponse.redirect(destination);
  if (customer) {
    const cookie = customerCookieOptions(customer.token);
    response.cookies.set(cookie.name, cookie.value, cookie);
  }
  return response;
}
