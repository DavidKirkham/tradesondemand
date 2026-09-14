import { NextResponse } from "next/server";
import { clearOpsCookieOptions } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookie = clearOpsCookieOptions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
