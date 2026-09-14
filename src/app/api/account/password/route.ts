import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { validateAccountLookup } from "@/lib/customer";
import {
  clearCustomerSetupCookieOptions,
  customerCookieOptions,
  getCustomerFromCookie,
  getCustomerFromSetupCookie,
  issueCustomerSession,
} from "@/lib/customer-auth";
import {
  canBootstrapCustomerPassword,
  customerPasswordMatches,
  hashCustomerPassword,
  validateCustomerPassword,
} from "@/lib/customer-password";
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
  const policy = validateCustomerPassword(password);
  if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    const fromInvite = await getCustomerFromSetupCookie();
    let customer = fromInvite;

    if (!customer) {
      const parsed = validateAccountLookup(String(body.email ?? ""), String(body.phone ?? ""));
      if (!parsed.ok) {
        return NextResponse.json(
          { error: "Enter the email and phone on your booking, or use the link from confirmation." },
          { status: 400 },
        );
      }
      customer = await prisma.customer.findFirst({
        where: { email: parsed.email, phone: parsed.phone },
      });
    }

    if (!customer || !canBootstrapCustomerPassword(customer)) {
      return NextResponse.json(
        {
          error: !customer
            ? "No private profile matches that email and phone. Book a job first, or create an account."
            : "A password is already set. Sign in, or reset it from the login page.",
        },
        { status: customer?.passwordHash ? 409 : 404 },
      );
    }

    const passwordHash = await hashCustomerPassword(password);
    const sessionToken = await issueCustomerSession(customer.id, {
      passwordHash,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    });
    const response = NextResponse.json({ ok: true, set: true });
    const cookie = customerCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    const setup = clearCustomerSetupCookieOptions();
    response.cookies.set(setup.name, setup.value, setup);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not set that password. Try again.");
  }
}

export async function PATCH(request: Request) {
  const customer = await getCustomerFromCookie();
  if (!customer) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: { currentPassword?: string; password?: string; confirm?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? password);
  const policy = validateCustomerPassword(password);
  if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  if (customer.passwordHash) {
    const currentPassword = String(body.currentPassword ?? "");
    if (!(await customerPasswordMatches(currentPassword, customer.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    if (currentPassword === password) {
      return NextResponse.json({ error: "Choose a new password." }, { status: 400 });
    }
  }

  try {
    const passwordHash = await hashCustomerPassword(password);
    const sessionToken = await issueCustomerSession(customer.id, {
      passwordHash,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    });
    const response = NextResponse.json({ ok: true });
    const cookie = customerCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not change that password. Try again.");
  }
}
