import { NextResponse } from "next/server";
import {
  adminAssignEventNote,
  contractorOffersTrade,
  jobIsAssignable,
  nextStatusOnAdminAssign,
} from "@/lib/admin-assign";
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
  let body: { contractorId?: string };
  try {
    body = (await request.json()) as { contractorId?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const contractorId = String(body.contractorId ?? "").trim();
  if (!contractorId) {
    return NextResponse.json({ error: "Pick an approved subcontractor." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { contractor: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (!jobIsAssignable(booking.status)) {
    return NextResponse.json({ error: "Cannot assign a cancelled job." }, { status: 400 });
  }

  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!contractor || contractor.status !== "APPROVED") {
    return NextResponse.json({ error: "Pick an approved subcontractor." }, { status: 400 });
  }
  if (!contractorOffersTrade(contractor.tradesJson, booking.trade)) {
    return NextResponse.json(
      { error: "That shop is not licensed for this job's trade." },
      { status: 400 },
    );
  }
  if (booking.contractorId === contractor.id) {
    return NextResponse.json({ error: "This job is already assigned to that shop." }, { status: 400 });
  }

  const nextStatus = nextStatusOnAdminAssign(booking.status) ?? booking.status;
  const note = adminAssignEventNote(contractor.businessName, booking.contractor?.businessName);

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      contractorId: contractor.id,
      matchPreference: "SPECIFIC",
      status: nextStatus,
      events: { create: { status: nextStatus, note } },
    },
    include: { contractor: true },
  });

  return NextResponse.json({
    booking: {
      id: updated.id,
      publicId: updated.publicId,
      status: updated.status,
      contractorId: updated.contractorId,
      contractorName: updated.contractor?.businessName ?? null,
    },
  });
}
