import { NextResponse } from "next/server";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import {
  CONTRACTOR_PAYOUT_COPY,
  contractorJobPaymentStatus,
  sumContractorPayments,
} from "@/lib/contractor-payments";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  const jobs = await prisma.booking.findMany({
    where: { contractorId: contractor.id },
    orderBy: { createdAt: "desc" },
    omit: BOOKING_SMS_OMIT,
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  const history = jobs
    .flatMap((job) => job.payments.map((payment) => ({ ...payment, bookingPublicId: job.publicId })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({
    copy: CONTRACTOR_PAYOUT_COPY,
    totals: sumContractorPayments(history),
    jobs: jobs.map((job) => {
      const totals = sumContractorPayments(job.payments);
      return {
        id: job.id,
        publicId: job.publicId,
        trade: job.trade,
        status: job.status,
        paymentStatus: contractorJobPaymentStatus(job.payments),
        paidCents: totals.paidCents,
        pendingCents: totals.pendingCents,
        refundedCents: totals.refundedCents,
      };
    }),
    history: history.map((payment) => ({
      id: payment.id,
      publicId: payment.publicId,
      bookingPublicId: payment.bookingPublicId,
      amountCents: payment.amountCents,
      type: payment.type,
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
    })),
  });
}
