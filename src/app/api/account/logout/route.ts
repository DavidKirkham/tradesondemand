import { NextResponse } from "next/server";
import { customerCookieOptions } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookie = customerCookieOptions("");
  response.cookies.set(cookie.name, "", { ...cookie, maxAge: 0 });
  return response;
}
