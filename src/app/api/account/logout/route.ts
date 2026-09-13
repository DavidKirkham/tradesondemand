import { NextResponse } from "next/server";
import {
  clearCustomerCookieOptions,
  clearCustomerLegacyCookieOptions,
  clearCustomerSetupCookieOptions,
} from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const cookie of [
    clearCustomerCookieOptions(),
    clearCustomerLegacyCookieOptions(),
    clearCustomerSetupCookieOptions(),
  ]) {
    response.cookies.set(cookie.name, "", { ...cookie, maxAge: 0 });
  }
  return response;
}
