import { NextResponse } from "next/server";
import { isContractorStatus } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to the ops board." }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string; note?: string };
  try {
    body = (await request.json()) as { status?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const status = String(body.status ?? "");
  if (!isContractorStatus(status)) {
    return NextResponse.json({ error: "Use pending, approved, or rejected." }, { status: 400 });
  }

  try {
    const contractor = await prisma.contractor.update({
      where: { id },
      data: {
        status,
        reviewNote: body.note?.trim() || null,
      },
    });
    return NextResponse.json({ contractor });
  } catch {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
}
