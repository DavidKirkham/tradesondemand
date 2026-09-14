import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAssignContractor } from "@/components/admin/AdminAssignContractor";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminInvoiceSection } from "@/components/admin/AdminInvoiceSection";
import { AdminJobDelete } from "@/components/admin/AdminJobDelete";
import { AdminJobStatus } from "@/components/admin/AdminJobStatus";
import { AdminPayoutTransfer } from "@/components/admin/AdminPayoutTransfer";
import { blockingJobPayments } from "@/lib/admin-job-delete";
import { statusLabel } from "@/lib/booking";
import { BOOKING_SMS_OMIT, isMissingBookingSmsColumn } from "@/lib/booking-sms-columns";
import { parseTradesJson } from "@/lib/contractor";
import { depositCreditCents, toInvoiceLineDrafts } from "@/lib/invoice";
import { loadBookingInvoice } from "@/lib/invoice-columns";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";
import { contractorPayoutStatusLabel, isMissingContractorPayoutModel } from "@/lib/contractor-payouts";
import { formatUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminGate>
      <JobDetail id={id} />
    </AdminGate>
  );
}

async function JobDetail({ id }: { id: string }) {
  if (!(await isOpsAuthenticated())) return null;

  const job = await prisma.booking.findFirst({
    where: { OR: [{ id }, { publicId: id }] },
    include: {
      contractor: true,
      customer: true,
      events: { orderBy: { createdAt: "desc" }, take: 12 },
      payments: {
        select: {
          id: true,
          publicId: true,
          status: true,
          type: true,
          amountCents: true,
          stripeCheckoutSessionId: true,
        },
      },
    },
    omit: BOOKING_SMS_OMIT,
  });
  if (!job) notFound();

  let customerSms: {
    customerSmsStatus: string | null;
    customerSmsBody: string | null;
    customerSmsError: string | null;
  } | null = null;
  try {
    customerSms = await prisma.booking.findUnique({
      where: { id: job.id },
      select: { customerSmsStatus: true, customerSmsBody: true, customerSmsError: true },
    });
  } catch (error) {
    if (!isMissingBookingSmsColumn(error)) throw error;
  }

  const blockedPayments = blockingJobPayments(job.payments);

  const approved = await prisma.contractor.findMany({
    where: { status: "APPROVED" },
    orderBy: { businessName: "asc" },
  });
  const contractors = approved.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    publicId: row.publicId,
    trades: parseTradesJson(row.tradesJson),
  }));
  const invoice = await loadBookingInvoice(job.id);
  let payout: {
    id: string;
    publicId: string;
    shopAmountCents: number;
    status: string;
    failureMessage: string | null;
    stripeTransferId: string | null;
    contractor: {
      stripeConnectAccountId: string | null;
      stripeConnectPayoutsEnabled: boolean;
    } | null;
    invoice: { status: string };
  } | null = null;
  try {
    payout = await prisma.contractorPayout.findFirst({
      where: { bookingId: job.id },
      include: {
        contractor: { select: { stripeConnectAccountId: true, stripeConnectPayoutsEnabled: true } },
        invoice: { select: { status: true } },
      },
    });
  } catch (error) {
    if (!isMissingContractorPayoutModel(error)) throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/jobs" className="text-sm font-semibold text-ember">
          ← Jobs
        </Link>
        <p className="mt-2 font-mono text-xs text-muted">{job.publicId}</p>
        <h1 className="font-display text-3xl text-navy">{getTrade(job.trade)?.name ?? job.trade}</h1>
        <p className="text-sm text-muted">
          {job.urgency} · {statusLabel(job.status)} · {job.city}, {job.state} {job.zip}
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl text-navy">Assign subcontractor</h2>
        <p className="mt-1 text-sm text-muted">
          Only approved shops licensed for this trade. Reassignment asks for confirmation, then the
          job shows under that shop&apos;s /contractor app.
        </p>
        <div className="mt-4">
          <AdminAssignContractor
            bookingId={job.id}
            trade={job.trade}
            currentContractorId={job.contractorId}
            currentContractorName={job.contractor?.businessName ?? null}
            contractors={contractors}
          />
        </div>
        {job.contractor ? (
          <p className="mt-3 text-sm text-navy">
            Current:{" "}
            <Link href={`/admin/contractors/${job.contractor.id}`} className="font-semibold text-ember">
              {job.contractor.businessName}
            </Link>
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Unassigned — first available.</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Client</h2>
          {job.customer ? (
            <Link href={`/admin/clients/${job.customer.id}`} className="mt-1 block font-semibold text-navy hover:underline">
              {job.customer.name}
            </Link>
          ) : (
            <p className="mt-1 font-semibold text-navy">{job.customerName}</p>
          )}
          <p className="text-sm text-muted">{formatPhone(job.customerPhone)}</p>
          <p className="text-sm text-muted">{job.customerEmail}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Site</h2>
          <p className="mt-1 text-navy">
            {job.street}
            <br />
            {job.city}, {job.state} {job.zip}
          </p>
          <p className="mt-3 text-sm text-navy">{job.problem}</p>
        </div>
      </section>

      {invoice ? (
        <AdminInvoiceSection
          jobId={job.id}
          depositPaidCents={depositCreditCents(job.payments, invoice.paymentId)}
          invoice={{
            publicId: invoice.publicId,
            status: invoice.status,
            note: invoice.note,
            laborCents: invoice.laborCents,
            materialsCents: invoice.materialsCents,
            subtotalCents: invoice.subtotalCents,
            customerSubtotalCents: invoice.customerSubtotalCents,
            markupCents: invoice.markupCents,
            depositPaidCents: invoice.depositPaidCents,
            amountDueCents: invoice.amountDueCents,
            lines: toInvoiceLineDrafts(invoice.lines),
          }}
        />
      ) : null}

      {payout ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-display text-xl text-navy">Shop payout</h2>
          <p className="mt-1 text-sm text-muted">
            {payout.publicId} · {contractorPayoutStatusLabel(payout.status)} · shop{" "}
            {formatUsd(payout.shopAmountCents)} (markup stays with TOD)
          </p>
          {payout.failureMessage ? <p className="mt-2 text-sm text-danger">{payout.failureMessage}</p> : null}
          {payout.stripeTransferId ? (
            <p className="mt-2 font-mono text-xs text-muted">{payout.stripeTransferId}</p>
          ) : (
            <div className="mt-3">
              <AdminPayoutTransfer
                payoutId={payout.id}
                canTransfer={
                  (payout.status === "PENDING" || payout.status === "FAILED") &&
                  payout.invoice.status === "PAID" &&
                  Boolean(payout.contractor?.stripeConnectAccountId) &&
                  Boolean(payout.contractor?.stripeConnectPayoutsEnabled)
                }
                label={payout.status === "FAILED" ? "Retry transfer" : "Transfer shop amount"}
              />
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-paper p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-navy">Status</h2>
          <AdminJobStatus id={job.id} status={job.status} />
        </div>
        {customerSms?.customerSmsStatus || customerSms?.customerSmsBody ? (
          <div className="mt-4 rounded-xl border border-line/70 px-3 py-2 text-sm">
            <p className="font-semibold text-navy">
              Client SMS: {customerSms.customerSmsStatus === "SENT"
                ? "sent"
                : customerSms.customerSmsStatus === "SKIPPED"
                  ? "skipped (Twilio not configured)"
                  : customerSms.customerSmsStatus === "FAILED"
                    ? "failed"
                    : customerSms.customerSmsStatus || "none"}
            </p>
            {customerSms.customerSmsBody ? <p className="mt-1 text-muted">{customerSms.customerSmsBody}</p> : null}
            {customerSms.customerSmsError ? <p className="mt-1 text-xs text-danger">{customerSms.customerSmsError}</p> : null}
          </div>
        ) : null}
        {job.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No status events yet.</p>
        ) : (
          <ol className="mt-4 space-y-2 text-sm">
            {job.events.map((event) => (
              <li key={event.id} className="rounded-xl border border-line/70 px-3 py-2">
                <p className="font-semibold text-navy">{statusLabel(event.status)}</p>
                {event.note ? <p className="text-muted">{event.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <AdminJobDelete
        id={job.id}
        publicId={job.publicId}
        blockingPayments={blockedPayments}
        cascadePaymentCount={job.payments.length - blockedPayments.length}
      />
    </div>
  );
}
