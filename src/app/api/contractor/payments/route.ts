import { NextResponse } from "next/server";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { CONTRACTOR_CONNECT_COPY } from "@/lib/contractor-connect";
import {
  CONTRACTOR_PAYOUT_COPY,
  contractorJobPaymentStatus,
  sumContractorPayments,
} from "@/lib/contractor-payments";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import {
  contractorConnectStatusLabel,
  contractorPayoutStatusLabel,
  isMissingContractorPayoutModel,
} from "@/lib/contractor-payouts";
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

  let payouts: {
    id: string;
    publicId: string;
    shopAmountCents: number;
    status: string;
    failureMessage: string | null;
    booking: { publicId: string };
    invoice: { publicId: string };
  }[] = [];
  try {
    payouts = await prisma.contractorPayout.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { publicId: true } },
        invoice: { select: { publicId: true } },
      },
    });
  } catch (error) {
    if (!isMissingContractorPayoutModel(error)) throw error;
  }

  return NextResponse.json({
    copy: CONTRACTOR_PAYOUT_COPY,
    connectCopy: CONTRACTOR_CONNECT_COPY,
    connect: {
      status: contractorConnectStatusLabel(contractor),
      onboarded: contractor.stripeConnectOnboarded,
      payoutsEnabled: contractor.stripeConnectPayoutsEnabled,
    },
    totals: sumContractorPayments(history),
    earnings: {
      owedCents: payouts
        .filter((row) => row.status === "PENDING" || row.status === "FAILED")
        .reduce((sum, row) => sum + row.shopAmountCents, 0),
      paidCents: payouts
        .filter((row) => row.status === "PAID")
        .reduce((sum, row) => sum + row.shopAmountCents, 0),
    },
    payouts: payouts.map((payout) => ({
      id: payout.id,
      publicId: payout.publicId,
      bookingPublicId: payout.booking.publicId,
      invoicePublicId: payout.invoice.publicId,
      shopAmountCents: payout.shopAmountCents,
      status: payout.status,
      statusLabel: contractorPayoutStatusLabel(payout.status),
      failureMessage: payout.failureMessage,
    })),
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
