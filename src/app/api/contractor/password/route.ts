import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isValidEmail, isValidUsPhone } from "@/lib/phone";
import {
  clearContractorSetupCookieOptions,
  contractorCookieOptions,
  getApprovedContractorFromCookie,
  getContractorFromSetupCookie,
  issueContractorSession,
} from "@/lib/contractor-auth";
import {
  canBootstrapContractorPassword,
  contractorPasswordMatches,
  hashContractorPassword,
  validateContractorPassword,
} from "@/lib/contractor-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; phone?: string; password?: string; confirm?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? password);
  const policy = validateContractorPassword(password);
  if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    const fromInvite = await getContractorFromSetupCookie();
    let contractor = fromInvite;

    if (!contractor) {
      const email = String(body.email ?? "").trim().toLowerCase();
      const phoneRaw = String(body.phone ?? "");
      if (!isValidEmail(email) || !isValidUsPhone(phoneRaw)) {
        return NextResponse.json(
          { error: "Enter the email and phone on your application, or use the invite link from dispatch." },
          { status: 400 },
        );
      }
      const phone = phoneRaw.replace(/\D/g, "").slice(-10);
      contractor = await prisma.contractor.findFirst({ where: { email, phone } });
    }

    if (!contractor || !canBootstrapContractorPassword(contractor)) {
      return NextResponse.json(
        {
          error:
            !contractor
              ? "No approved contractor matches that email and phone."
              : contractor.passwordHash
                ? "A password is already set. Sign in, or ask dispatch to reset it."
                : "Your application is not approved yet.",
        },
        { status: contractor?.passwordHash ? 409 : 403 },
      );
    }

    const passwordHash = await hashContractorPassword(password);
    const sessionToken = await issueContractorSession(contractor.id, { passwordHash });
    const response = NextResponse.json({ ok: true, set: true });
    const cookie = contractorCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    const setup = clearContractorSetupCookieOptions();
    response.cookies.set(setup.name, setup.value, setup);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not set that password. Try again.");
  }
}

export async function PATCH(request: Request) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  let body: { currentPassword?: string; password?: string; confirm?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? password);
  if (!(await contractorPasswordMatches(currentPassword, contractor.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }
  const policy = validateContractorPassword(password);
  if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (currentPassword === password) {
    return NextResponse.json({ error: "Choose a new password." }, { status: 400 });
  }

  try {
    const passwordHash = await hashContractorPassword(password);
    const sessionToken = await issueContractorSession(contractor.id, { passwordHash });
    const response = NextResponse.json({ ok: true });
    const cookie = contractorCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not change that password. Try again.");
  }
}
