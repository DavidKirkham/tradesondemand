import { NextResponse } from "next/server";
import { clearContractorCookieOptions } from "@/lib/contractor-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookie = clearContractorCookieOptions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
