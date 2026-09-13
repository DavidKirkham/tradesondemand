import { NextResponse } from "next/server";
import { createContractorLoginToken } from "@/lib/contractor";
import { contractorLoginBlockReason } from "@/lib/contractor-app";
import { contractorCookieOptions } from "@/lib/contractor-auth";
import { isValidEmail, isValidUsPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; phone?: string };
  try {
    body = (await request.json()) as { email?: string; phone?: string };
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const phoneRaw = String(body.phone ?? "");
  if (!isValidEmail(email) || !isValidUsPhone(phoneRaw)) {
    return NextResponse.json({ error: "Enter the email and phone on your application." }, { status: 400 });
  }
  const phone = phoneRaw.replace(/\D/g, "").slice(-10);

  const contractor = await prisma.contractor.findFirst({
    where: { email, phone },
  });
  if (!contractor) {
    return NextResponse.json({ error: "No approved contractor matches that email and phone." }, { status: 404 });
  }

  const blocked = contractorLoginBlockReason(contractor.status);
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 403 });
  }

  let loginToken = contractor.loginToken;
  if (!loginToken) {
    loginToken = createContractorLoginToken();
    await prisma.contractor.update({ where: { id: contractor.id }, data: { loginToken } });
  }

  const response = NextResponse.json({ ok: true });
  const cookie = contractorCookieOptions(loginToken);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
