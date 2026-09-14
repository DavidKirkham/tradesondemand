import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorConnectOnboard } from "@/components/contractor-app/ContractorConnectOnboard";
import { statusLabel } from "@/lib/booking";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import {
  createAccountLinkForRefresh,
  refreshContractorConnectFromStripe,
} from "@/lib/contractor-connect";
import {
  CONTRACTOR_PAYOUT_COPY,
  contractorJobPaymentLabel,
  contractorJobPaymentStatus,
  sumContractorPayments,
} from "@/lib/contractor-payments";
import { requireApprovedContractor } from "@/lib/contractor-auth";
import {
  contractorConnectStatusCopy,
  contractorConnectStatusLabel,
  contractorPayoutStatusLabel,
  isMissingContractorPayoutModel,
} from "@/lib/contractor-payouts";
import { formatUsd } from "@/lib/money";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { appOriginFromHeaders } from "@/lib/stripe";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function ContractorPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const contractor = await requireApprovedContractor("/contractor/payments");
  const params = await searchParams;

  if (params.connect === "refresh" || params.connect === "return") {
    await refreshContractorConnectFromStripe(contractor.id);
  }
  if (params.connect === "refresh") {
    const origin = appOriginFromHeaders(await headers());
    const url = await createAccountLinkForRefresh(contractor, origin);
    if (url) redirect(url);
  }

  const latest = await prisma.contractor.findUnique({ where: { id: contractor.id } });
  const shop = latest ?? contractor;
  const connectStatus = contractorConnectStatusLabel({
    stripeConnectAccountId: shop.stripeConnectAccountId,
    stripeConnectOnboarded: shop.stripeConnectOnboarded,
    stripeConnectPayoutsEnabled: shop.stripeConnectPayoutsEnabled,
  });

  const jobs = await prisma.booking.findMany({
    where: { contractorId: contractor.id },
    orderBy: { createdAt: "desc" },
    omit: BOOKING_SMS_OMIT,
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  let payouts: {
    id: string;
    publicId: string;
    shopAmountCents: number;
    status: string;
    booking: { publicId: string; id: string };
    invoice: { publicId: string };
    failureMessage: string | null;
  }[] = [];
  try {
    payouts = await prisma.contractorPayout.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { id: true, publicId: true } },
        invoice: { select: { publicId: true } },
      },
    });
  } catch (error) {
    if (!isMissingContractorPayoutModel(error)) throw error;
  }

  const history = jobs
    .flatMap((job) => job.payments.map((payment) => ({ ...payment, bookingPublicId: job.publicId, bookingId: job.id })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const totals = sumContractorPayments(history);
  const earnedCents = payouts.reduce((sum, row) => sum + (row.status === "PAID" ? row.shopAmountCents : 0), 0);
  const owedCents = payouts.reduce(
    (sum, row) => sum + (row.status === "PENDING" || row.status === "FAILED" ? row.shopAmountCents : 0),
    0,
  );

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <h1 className="font-display text-2xl text-navy">Payouts</h1>
      <p className="mt-1 text-sm text-muted">{CONTRACTOR_PAYOUT_COPY}</p>
      {params.connect === "return" ? (
        <p className="mt-3 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-navy">
          {contractorConnectStatusCopy(connectStatus)}. Stripe will text or email if anything else is needed.
        </p>
      ) : null}

      <div className="mt-5">
        <ContractorConnectOnboard status={connectStatus} />
      </div>

      <section className="mt-5 grid grid-cols-2 gap-2">
        <Stat label="Shop owed" value={formatUsd(owedCents)} />
        <Stat label="Transferred" value={formatUsd(earnedCents)} />
        <Stat label="Paid to TOD" value={formatUsd(totals.paidCents)} />
        <Stat label="Pending with TOD" value={formatUsd(totals.pendingCents)} />
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Shop earnings</h2>
        {payouts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            Nothing owed yet. After a customer pays your invoice, the shop subtotal shows here for TOD to
            transfer. The 20% markup never comes to you.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {payouts.map((payout) => (
              <li key={payout.id} className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted">
                      {payout.publicId} · {payout.invoice.publicId}
                    </p>
                    <Link href={`/contractor/jobs/${payout.booking.id}`} className="font-semibold text-navy">
                      {payout.booking.publicId}
                    </Link>
                    <p className="text-xs text-muted">{contractorPayoutStatusLabel(payout.status)}</p>
                    {payout.failureMessage ? (
                      <p className="mt-1 text-xs text-danger">{payout.failureMessage}</p>
                    ) : null}
                  </div>
                  <p className="text-right font-semibold text-navy">{formatUsd(payout.shopAmountCents)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Per-job customer payment</h2>
        {jobs.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            No jobs assigned yet, so there is nothing owed or paid to show.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {jobs.map((job) => {
              const ledger = contractorJobPaymentStatus(job.payments);
              const sums = sumContractorPayments(job.payments);
              return (
                <li key={job.id}>
                  <Link href={`/contractor/jobs/${job.id}`} className="block rounded-2xl border border-line bg-paper p-4">
                    <p className="font-mono text-xs text-muted">{job.publicId}</p>
                    <p className="font-display text-xl text-navy">{getTrade(job.trade)?.name ?? job.trade}</p>
                    <p className="text-sm text-muted">
                      {statusLabel(job.status)} · {contractorJobPaymentLabel(ledger)}
                    </p>
                    {job.payments.length > 0 ? (
                      <p className="mt-1 text-sm text-navy">
                        {formatUsd(sums.paidCents)} paid to TOD
                        {sums.pendingCents > 0 ? ` · ${formatUsd(sums.pendingCents)} pending` : ""}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">TOD payment history</h2>
        {history.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            No deposit or job-balance records on your tickets yet. When a customer pays TOD, it shows up
            here. Your shop payout still comes from Trades on Demand — not the customer.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((payment) => (
              <li
                key={payment.id}
                className="flex justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-mono text-xs text-muted">{payment.publicId}</p>
                  <p className="text-navy">
                    {paymentTypeLabel(payment.type)} · {payment.bookingPublicId}
                  </p>
                </div>
                <p className="text-right text-navy">
                  {formatUsd(payment.amountCents)}
                  <span className="mt-1 block text-xs text-muted">{paymentStatusLabel(payment.status)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ContractorAppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-3 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-xl text-navy">{value}</p>
    </div>
  );
}
