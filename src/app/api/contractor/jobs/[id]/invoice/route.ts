import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { BOOKING_SMS_OMIT, isMissingBookingSmsColumn } from "@/lib/booking-sms-columns";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import {
  contractorCanInvoiceJob,
  depositCreditCents,
  totalsFromLines,
  validateInvoicePayload,
} from "@/lib/invoice";
import { isMissingInvoiceMarkupColumn, isMissingInvoiceModel } from "@/lib/invoice-columns";
import { invoiceLockedReason, persistInvoiceEdits } from "@/lib/invoice-persist";
import { ensureContractorPayoutForPaidInvoice } from "@/lib/contractor-connect";
import { prisma } from "@/lib/prisma";
import { appOriginFromRequest } from "@/lib/stripe";
import { buildInvoiceSms, sendCustomerSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    send?: boolean;
    labor?: { description?: string; hours?: string; rate?: string }[];
    materials?: { description?: string; cost?: string }[];
    note?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  try {
    return await saveContractorInvoice(request, id, contractor, body);
  } catch (error) {
    if (isMissingInvoiceMarkupColumn(error)) {
      try {
        return await saveContractorInvoice(request, id, contractor, body, true);
      } catch (retryError) {
        return prismaFailureResponse(retryError, "Could not save that invoice. Try again.");
      }
    }
    if (isMissingInvoiceModel(error)) {
      return prismaFailureResponse(error, "Could not save that invoice. Try again.");
    }
    return prismaFailureResponse(error, "Could not save that invoice. Try again.");
  }
}

async function saveContractorInvoice(
  request: Request,
  id: string,
  contractor: { id: string; businessName: string },
  body: {
    send?: boolean;
    labor?: { description?: string; hours?: string; rate?: string }[];
    materials?: { description?: string; cost?: string }[];
    note?: string;
  },
  omitMarkupColumns = false,
) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    omit: BOOKING_SMS_OMIT,
    include: { payments: true },
  });
  if (!booking) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (booking.contractorId !== contractor.id) {
    return NextResponse.json({ error: "Only the assigned shop can invoice this job." }, { status: 403 });
  }
  if (!contractorCanInvoiceJob(booking.status)) {
    return NextResponse.json({ error: "Cancelled jobs cannot be invoiced." }, { status: 400 });
  }

  const parsed = validateInvoicePayload(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const existing = await prisma.invoice.findUnique({
    where: { bookingId: id },
    include: { payment: true },
  });
  const locked = invoiceLockedReason(existing);
  if (locked) {
    return NextResponse.json({ error: locked }, { status: 400 });
  }

  const send = Boolean(body.send);
  const alreadySent = existing?.status === "SENT";
  const publish = send || alreadySent;
  const depositPaidCents = depositCreditCents(booking.payments, existing?.paymentId);
  const totals = totalsFromLines(parsed.lines, depositPaidCents);

  const invoice = await prisma.$transaction(async (tx) => {
    const updated = await persistInvoiceEdits(tx, {
      booking,
      existing,
      contractorId: contractor.id,
      lines: parsed.lines,
      totals,
      note: parsed.note,
      publish,
      omitMarkupColumns,
    });

    if (publish && booking.status !== "COMPLETED") {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "COMPLETED",
          events: {
            create: {
              status: "COMPLETED",
              note: `Invoice ${updated.publicId} sent — customer pays TOD`,
            },
          },
        },
      });
    } else if (send) {
      await tx.statusEvent.create({
        data: {
          bookingId: booking.id,
          status: booking.status,
          note: `Invoice ${updated.publicId} sent — customer pays TOD`,
        },
      });
    }

    return updated;
  });

  if (invoice.status === "PAID") {
    await ensureContractorPayoutForPaidInvoice(invoice.id);
  }

  let sms:
    | { status: string; body: string | null; error: string | null; persistSkipped?: boolean }
    | undefined;

  if (send) {
    const origin = appOriginFromRequest(request);
    const payUrl = `${origin}/account/jobs/${encodeURIComponent(booking.publicId)}`;
    const text = buildInvoiceSms({
      businessName: contractor.businessName,
      publicId: booking.publicId,
      amountDueCents: invoice.amountDueCents,
      payUrl,
    });
    const result = await sendCustomerSms(booking.customerPhone, text);
    const eventNote =
      result.status === "SENT"
        ? `Texted invoice ${invoice.publicId} to the customer`
        : result.status === "SKIPPED"
          ? `Invoice saved; SMS skipped: ${result.error ?? "not sent"}`
          : `Invoice saved; SMS failed: ${result.error ?? "unknown"}`;
    await prisma.statusEvent.create({
      data: { bookingId: booking.id, status: "COMPLETED", note: eventNote },
    });
    let persistSkipped = false;
    try {
      await prisma.booking.update({
        where: { id: booking.id },
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

  return NextResponse.json({ invoice, sms });
}
