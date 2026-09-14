import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CUSTOMER_LEGACY_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  customerLoginHref,
  isPublicAccountPath,
} from "@/lib/customer-paths";
import { CONTRACTOR_SESSION_COOKIE, contractorLoginHref, isPublicContractorPath } from "@/lib/contractor-paths";

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/contractor")) {
    headers.set("x-tod-surface", "contractor");
  }

  if (pathname.startsWith("/contractor") && !isPublicContractorPath(pathname)) {
    const session = request.cookies.get(CONTRACTOR_SESSION_COOKIE)?.value;
    if (!session) {
      const login = new URL(contractorLoginHref(pathname), request.url);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/account") && !isPublicAccountPath(pathname)) {
    const session = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const legacy = request.cookies.get(CUSTOMER_LEGACY_COOKIE)?.value;
    if (!session && !legacy) {
      const login = new URL(customerLoginHref(pathname), request.url);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/contractor", "/contractor/:path*", "/account", "/account/:path*"],
};
