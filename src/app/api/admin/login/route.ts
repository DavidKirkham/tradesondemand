import { NextResponse } from "next/server";
import { opsCookieOptions, passwordMatches } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "Sign-in failed." }, { status: 401 });
  }

  const cookie = opsCookieOptions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
