import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  if (request.nextUrl.pathname.startsWith("/contractor")) {
    headers.set("x-tod-surface", "contractor");
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/contractor", "/contractor/:path*"],
};
