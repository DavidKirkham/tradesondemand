import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import {
  contractorWhereIdentifier,
  parseContractorIdentifier,
} from "@/lib/contractor-password";
import {
  contractorPasswordResetEligibility,
  generatePasswordResetCode,
  generatePasswordResetToken,
  hashPasswordResetCode,
  hashPasswordResetToken,
  PASSWORD_RESET_REQUEST_MESSAGE,
  PASSWORD_RESET_TTL_MS,
  passwordResetOnCooldown,
  passwordResetRequestIpAllowed,
  requestClientKey,
} from "@/lib/contractor-password-reset";
import { prisma } from "@/lib/prisma";
import { appOriginFromRequest } from "@/lib/stripe";
import { buildContractorPasswordResetSms, sendCustomerSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { identifier?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const identifier = parseContractorIdentifier(String(body.identifier ?? ""));
  if (!identifier) {
    return NextResponse.json(
      { error: "Enter the shop email, phone, or ID you use to sign in." },
      { status: 400 },
    );
  }

  if (!passwordResetRequestIpAllowed(requestClientKey(request))) {
    return NextResponse.json({ error: "Try again in a few minutes." }, { status: 429 });
  }

  try {
    const contractor = await prisma.contractor.findFirst({
      where: contractorWhereIdentifier(identifier),
      include: { passwordReset: true },
    });

    if (contractorPasswordResetEligibility(contractor) === "send" && contractor) {
      if (!passwordResetOnCooldown(contractor.passwordReset?.sentAt)) {
        const token = generatePasswordResetToken();
        const code = generatePasswordResetCode();
        const now = new Date();
        await prisma.contractorPasswordReset.upsert({
          where: { contractorId: contractor.id },
          create: {
            contractorId: contractor.id,
            tokenHash: hashPasswordResetToken(token),
            codeHash: await hashPasswordResetCode(code),
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
            sentAt: now,
            attempts: 0,
          },
          update: {
            tokenHash: hashPasswordResetToken(token),
            codeHash: await hashPasswordResetCode(code),
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
            sentAt: now,
            attempts: 0,
          },
        });

        const resetUrl = `${appOriginFromRequest(request)}/contractor/r/${token}`;
        await sendCustomerSms(
          contractor.phone,
          buildContractorPasswordResetSms({ code, resetUrl }),
        );
      }
    }

    return NextResponse.json({ ok: true, message: PASSWORD_RESET_REQUEST_MESSAGE });
  } catch (error) {
    return prismaFailureResponse(error, "Could not start a password reset. Try again.");
  }
}
