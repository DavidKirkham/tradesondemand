import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { contractorCookieOptions, issueContractorSession } from "@/lib/contractor-auth";
import {
  contractorPasswordMatches,
  contractorWhereIdentifier,
  hashContractorPassword,
  parseContractorIdentifier,
  validateContractorPassword,
} from "@/lib/contractor-password";
import {
  contractorPasswordResetConfirmDecision,
  hashPasswordResetToken,
  parsePasswordResetCode,
  parsePasswordResetToken,
  PASSWORD_RESET_INVALID_MESSAGE,
  passwordResetConfirmIpAllowed,
  requestClientKey,
} from "@/lib/contractor-password-reset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { token?: string; identifier?: string; code?: string; password?: string; confirm?: string };
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

  const token = parsePasswordResetToken(String(body.token ?? ""));
  const code = parsePasswordResetCode(String(body.code ?? ""));
  const identifier = parseContractorIdentifier(String(body.identifier ?? ""));
  if (!token && !(code && identifier)) {
    return NextResponse.json(
      { error: "Enter the reset code from your text, or open the reset link." },
      { status: 400 },
    );
  }

  if (!passwordResetConfirmIpAllowed(requestClientKey(request))) {
    return NextResponse.json({ error: "Try again in a few minutes." }, { status: 429 });
  }

  try {
    const reset = token
      ? await prisma.contractorPasswordReset.findUnique({
          where: { tokenHash: hashPasswordResetToken(token) },
          include: { contractor: true },
        })
      : null;

    const byCode =
      !reset && identifier
        ? await prisma.contractor.findFirst({
            where: contractorWhereIdentifier(identifier),
            include: { passwordReset: true },
          })
        : null;

    const contractor = reset?.contractor ?? byCode;
    const activeReset = reset ?? byCode?.passwordReset ?? null;
    const secretOk = reset
      ? true
      : activeReset
        ? await contractorPasswordMatches(code ?? "", activeReset.codeHash)
        : false;

    const decision = contractorPasswordResetConfirmDecision({
      reset: activeReset,
      contractorStatus: contractor?.status,
      secretOk,
    });

    if (!decision.ok) {
      if (activeReset) {
        if (decision.lock) {
          await prisma.contractorPasswordReset.deleteMany({ where: { id: activeReset.id } });
        } else {
          await prisma.contractorPasswordReset.update({
            where: { id: activeReset.id },
            data: { attempts: { increment: 1 } },
          });
        }
      }
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }

    if (!contractor || !activeReset) {
      return NextResponse.json({ error: PASSWORD_RESET_INVALID_MESSAGE }, { status: 401 });
    }

    if (await contractorPasswordMatches(password, contractor.passwordHash)) {
      return NextResponse.json({ error: "Choose a new password." }, { status: 400 });
    }

    const passwordHash = await hashContractorPassword(password);
    const sessionToken = await issueContractorSession(contractor.id, { passwordHash });
    await prisma.contractorPasswordReset.deleteMany({ where: { contractorId: contractor.id } });

    const response = NextResponse.json({ ok: true });
    const cookie = contractorCookieOptions(sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return prismaFailureResponse(error, "Could not reset that password. Try again.");
  }
}
