import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { resetContractorPasswordAccess } from "@/lib/contractor-auth";
import { hashContractorPassword, validateContractorPassword } from "@/lib/contractor-password";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const { id } = await params;
  let body: { action?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const existing = await prisma.contractor.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Subcontractor not found." }, { status: 404 });
  }

  const action = body.action === "set" ? "set" : "reset";

  try {
    if (action === "set") {
      const password = String(body.password ?? "");
      const policy = validateContractorPassword(password);
      if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });
      const passwordHash = await hashContractorPassword(password);
      await prisma.contractor.update({
        where: { id },
        data: { passwordHash, sessionToken: null },
      });
      return NextResponse.json({ ok: true, passwordSet: true });
    }

    const reset = await resetContractorPasswordAccess(id);
    return NextResponse.json({
      ok: true,
      passwordSet: false,
      invitePath: reset.invitePath,
    });
  } catch (error) {
    return prismaFailureResponse(error, "Could not update contractor password.");
  }
}
