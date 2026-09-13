import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorInvoiceForm } from "@/components/contractor-app/ContractorInvoiceForm";
import { ContractorJobActions } from "@/components/contractor-app/ContractorJobActions";
import { statusLabel } from "@/lib/booking";
import { BOOKING_SMS_OMIT, isMissingBookingSmsColumn } from "@/lib/booking-sms-columns";
import { parseTradeRatesJson, rateForTrade } from "@/lib/contractor";
import { isPastContractorJob, jobFitsContractor } from "@/lib/contractor-app";
import { requireApprovedContractor } from "@/lib/contractor-auth";
import {
  contractorJobPaymentLabel,
  contractorJobPaymentStatus,
  sumContractorPayments,
} from "@/lib/contractor-payments";
import { contractorCanInvoiceJob, depositCreditCents, toInvoiceLineDrafts } from "@/lib/invoice";
import { loadBookingInvoice } from "@/lib/invoice-columns";
import { formatUsd } from "@/lib/money";
import { formatPhone, telHref } from "@/lib/phone";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function ContractorJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contractor = await requireApprovedContractor(`/contractor/jobs/${id}`);
  const job = await prisma.booking.findUnique({
    where: { id },
    omit: BOOKING_SMS_OMIT,
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!job) notFound();

  let smsStatus: string | null = null;
  try {
    const sms = await prisma.booking.findUnique({
      where: { id },
      select: { customerSmsStatus: true },
    });
    smsStatus = sms?.customerSmsStatus ?? null;
  } catch (error) {
    if (!isMissingBookingSmsColumn(error)) throw error;
  }

  const assigned = job.contractorId === contractor.id;
  const available = !job.contractorId && jobFitsContractor(job, contractor);
  if (!assigned && !available) notFound();
  const closed = isPastContractorJob(job.status);
  const ledger = assigned ? contractorJobPaymentStatus(job.payments) : null;
  const paymentTotals = assigned ? sumContractorPayments(job.payments) : null;
  const invoice = assigned ? await loadBookingInvoice(job.id) : null;
  const tradeRate = rateForTrade(
    {
      hourlyRateCents: contractor.hourlyRateCents,
      minimumChargeCents: contractor.minimumChargeCents,
      tradeRates: parseTradeRatesJson(contractor.tradeRatesJson),
    },
    job.trade,
  );
  const depositPaidCents = depositCreditCents(job.payments, invoice?.paymentId);

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <Link href={closed ? "/contractor/past" : "/contractor"} className="text-sm font-semibold text-ember">
        ← {closed ? "Past jobs" : "Jobs"}
      </Link>
      <p className="mt-3 font-mono text-xs text-muted">{job.publicId}</p>
      <h1 className="font-display text-3xl text-navy">{getTrade(job.trade)?.name ?? job.trade}</h1>
      <p className={`mt-1 text-sm font-semibold ${job.urgency === "emergency" ? "text-ember" : "text-navy"}`}>
        {job.urgency} · {statusLabel(job.status)}
      </p>

      <section className="mt-5 rounded-2xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Site</h2>
        {assigned ? (
          <p className="mt-1 text-navy">
            {job.street}
            <br />
            {job.city}, {job.state} {job.zip}
          </p>
        ) : (
          <p className="mt-1 text-navy">
            {job.city}, {job.state} {job.zip}
            <span className="mt-1 block text-sm text-muted">Full street after you accept.</span>
          </p>
        )}
      </section>

      {assigned ? (
        <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Customer</h2>
          <p className="mt-1 font-semibold text-navy">{job.customerName}</p>
          <a href={telHref(job.customerPhone)} className="text-sm font-semibold text-ember">
            {formatPhone(job.customerPhone)}
          </a>
          <p className="text-sm text-muted">{job.customerEmail}</p>
        </section>
      ) : (
        <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Customer</h2>
          <p className="mt-1 text-sm text-muted">Contact is available after you accept. The desk texts them for you.</p>
        </section>
      )}

      <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Problem</h2>
        <p className="mt-1 text-navy">{job.problem}</p>
      </section>

      {assigned && paymentTotals ? (
        <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">TOD payment</h2>
          <p className="mt-1 text-sm text-navy">{ledger ? contractorJobPaymentLabel(ledger) : null}</p>
          {job.payments.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No customer deposit or balance on this ticket yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-navy">
              {job.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3">
                  <span>
                    {paymentTypeLabel(payment.type)} · {paymentStatusLabel(payment.status)}
                  </span>
                  <span>{formatUsd(payment.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">
            {formatUsd(paymentTotals.paidCents)} paid to TOD
            {paymentTotals.pendingCents > 0 ? ` · ${formatUsd(paymentTotals.pendingCents)} pending` : ""}. Shop
            payouts come from Trades on Demand.
          </p>
        </section>
      ) : null}

      {assigned && contractorCanInvoiceJob(job.status) ? (
        <div className="mt-4">
          <ContractorInvoiceForm
            jobId={job.id}
            defaultLaborRateCents={tradeRate.hourlyCents}
            depositPaidCents={depositPaidCents}
            invoice={
              invoice
                ? {
                    publicId: invoice.publicId,
                    status: invoice.status,
                    note: invoice.note,
                    laborCents: invoice.laborCents,
                    materialsCents: invoice.materialsCents,
                    subtotalCents: invoice.subtotalCents,
                    depositPaidCents: invoice.depositPaidCents,
                    amountDueCents: invoice.amountDueCents,
                    lines: toInvoiceLineDrafts(invoice.lines),
                  }
                : null
            }
          />
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        Customers pay Trades on Demand. Do not take a card or cash as TOD payment.
      </p>

      <div className="mt-4">
        <ContractorJobActions
          id={job.id}
          status={job.status}
          assigned={assigned}
          closed={closed}
          smsStatus={smsStatus}
        />
      </div>
    </ContractorAppShell>
  );
}
