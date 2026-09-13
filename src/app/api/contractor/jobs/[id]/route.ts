import { NextResponse } from "next/server";
import { jobFitsContractor, isContractorJobStatus } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string; note?: string; claim?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const assigned = booking.contractorId === contractor.id;
  const available = !booking.contractorId && jobFitsContractor(booking, contractor);
  if (!assigned && !available) {
    return NextResponse.json({ error: "This job is not assigned to your shop." }, { status: 403 });
  }

  const data: {
    contractorId?: string;
    matchPreference?: string;
    status?: string;
    events?: { create: { status: string; note: string | null } };
  } = {};

  if (body.claim || (available && body.status)) {
    data.contractorId = contractor.id;
    data.matchPreference = "SPECIFIC";
  }

  if (body.status !== undefined) {
    if (!isContractorJobStatus(body.status)) {
      return NextResponse.json({ error: "Use en route, on site, or done." }, { status: 400 });
    }
    data.status = body.status;
    data.events = { create: { status: body.status, note: body.note?.trim() || null } };
  } else if (body.claim) {
    data.status = "DISPATCHED";
    data.events = { create: { status: "DISPATCHED", note: body.note?.trim() || "Accepted in contractor app" } };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.booking.update({ where: { id }, data });
  return NextResponse.json({ booking: updated });
}
