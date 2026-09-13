import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { BOOKING_SMS_OMIT, isMissingBookingSmsColumn } from "@/lib/booking-sms-columns";
import {
  isContractorJobStatus,
  isPastContractorJob,
  jobFitsContractor,
  validateContractorCustomerMessage,
} from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";
import { buildAcceptEtaSms, buildContractorCustomerSms, sendCustomerSms } from "@/lib/sms";

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
  let body: { status?: string; note?: string; claim?: boolean; eta?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  try {
    return await applyContractorJobPatch(id, contractor, body);
  } catch (error) {
    return prismaFailureResponse(error, "Could not update that job. Try again.");
  }
}

async function applyContractorJobPatch(
  id: string,
  contractor: { id: string; businessName: string; tradesJson: string; serviceArea: string },
  body: { status?: string; note?: string; claim?: boolean; eta?: string; message?: string },
) {
  const booking = await prisma.booking.findUnique({ where: { id }, omit: BOOKING_SMS_OMIT });
  if (!booking) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const assigned = booking.contractorId === contractor.id;
  const available = !booking.contractorId && jobFitsContractor(booking, contractor);
  if (booking.contractorId && !assigned && (body.claim || body.eta || body.message)) {
    return NextResponse.json(
      { error: "This job was already taken by another shop." },
      { status: 409 },
    );
  }
  if (!assigned && !available) {
    return NextResponse.json({ error: "This job is not assigned to your shop." }, { status: 403 });
  }

  const eta = body.eta?.trim() ?? "";
  const outbound = body.message?.trim() ?? "";
  const wantsClaim =
    Boolean(body.claim) || (available && (Boolean(body.status) || Boolean(eta) || Boolean(outbound)));

  if (wantsClaim && !assigned) {
    const claimed = await prisma.booking.updateMany({
      where: {
        id,
        contractorId: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        contractorId: contractor.id,
        matchPreference: "SPECIFIC",
        status: "DISPATCHED",
      },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This job was already taken by another shop." },
        { status: 409 },
      );
    }
    await prisma.statusEvent.create({
      data: {
        bookingId: id,
        status: "DISPATCHED",
        note: body.note?.trim() || "Accepted in contractor app",
      },
    });
  }

  if (body.status !== undefined) {
    if (!assigned && !wantsClaim) {
      return NextResponse.json({ error: "Accept the job before updating status." }, { status: 400 });
    }
    if (isPastContractorJob(booking.status) && !wantsClaim) {
      return NextResponse.json({ error: "This job is already closed." }, { status: 400 });
    }
    if (!isContractorJobStatus(body.status)) {
      return NextResponse.json({ error: "Use en route, on site, or done." }, { status: 400 });
    }
    await prisma.booking.update({
      where: { id },
      data: {
        status: body.status,
        events: { create: { status: body.status, note: body.note?.trim() || null } },
      },
      omit: BOOKING_SMS_OMIT,
    });
  }

  let sms:
    | { status: string; body: string | null; error: string | null; persistSkipped?: boolean }
    | undefined;

  const smsRaw = eta || outbound;
  if (smsRaw) {
    const parsed = validateContractorCustomerMessage(smsRaw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
    const current = await prisma.booking.findUnique({ where: { id }, omit: BOOKING_SMS_OMIT });
    if (!current || current.contractorId !== contractor.id) {
      return NextResponse.json({ error: "Accept the job before texting the client." }, { status: 400 });
    }
    const text = eta
      ? buildAcceptEtaSms({
          businessName: contractor.businessName,
          publicId: current.publicId,
          eta: parsed.message,
        })
      : buildContractorCustomerSms({
          businessName: contractor.businessName,
          publicId: current.publicId,
          message: parsed.message,
        });
    const result = await sendCustomerSms(current.customerPhone, text);
    const kind = eta ? "ETA" : "Note";
    const eventNote =
      result.status === "SENT"
        ? `Texted the client: ${parsed.message}`
        : result.status === "SKIPPED"
          ? `${kind} saved; SMS skipped: ${result.error ?? "not sent"}`
          : `${kind} saved; SMS failed: ${result.error ?? "unknown"}`;
    await prisma.statusEvent.create({
      data: { bookingId: id, status: current.status, note: eventNote },
    });
    let persistSkipped = false;
    try {
      await prisma.booking.update({
        where: { id },
        data: {
          customerSmsStatus: result.status,
          customerSmsBody: text,
          customerSmsError: result.error ?? null,
        },
        omit: BOOKING_SMS_OMIT,
      });
    } catch (error) {
      if (!isMissingBookingSmsColumn(error)) throw error;
      persistSkipped = true;
    }
    sms = {
      status: result.status,
      body: text,
      error: result.error ?? null,
      persistSkipped,
    };
  }

  const updated = await prisma.booking.findUnique({ where: { id }, omit: BOOKING_SMS_OMIT });
  return NextResponse.json({
    booking: updated,
    sms,
  });
}
