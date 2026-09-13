import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/contractor", "/contractor/:path*"],
};
