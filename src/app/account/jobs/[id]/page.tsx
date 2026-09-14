import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountPayButton } from "@/components/account/AccountPayButton";
import { AccountShell } from "@/components/account/AccountShell";
import { InvoiceBreakdown } from "@/components/invoice/InvoiceBreakdown";
import { statusDetail, statusLabel } from "@/lib/booking";
import { requireCustomer } from "@/lib/customer-auth";
import { customerPaymentLine, customerPaymentTotals, payableCustomerPayments } from "@/lib/customer-jobs";
import { customerCanSeeInvoice } from "@/lib/invoice";
import { loadBookingInvoice } from "@/lib/invoice-columns";
import { formatUsd } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Job",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string }>;
}) {
  const { id } = await params;
  const customer = await requireCustomer(`/account/jobs/${id}`);
  const query = await searchParams;
  const booking = await prisma.booking.findFirst({
    where: {
      customerId: customer.id,
      OR: [{ id }, { publicId: id }, { token: id }],
    },
    include: {
      contractor: true,
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) notFound();

  const trade = getTrade(booking.trade);
  const totals = customerPaymentTotals(booking.payments);
  const payable = payableCustomerPayments(booking.payments);
  const created = booking.createdAt.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const invoiceRecord = await loadBookingInvoice(booking.id);
  const invoice =
    invoiceRecord && customerCanSeeInvoice(invoiceRecord.status) ? invoiceRecord : null;
  const invoicePayment = invoice?.payment ?? null;
  const invoicePayable =
    invoicePayment && payable.some((row) => row.id === invoicePayment.id) ? invoicePayment : null;

  return (
    <AccountShell name={customer.name} needsPassword={!customer.passwordHash}>
      <p className="stamp text-xs text-ember">{booking.publicId}</p>
      <h2 className="mt-2 font-display text-3xl text-navy">{trade?.name ?? booking.trade}</h2>
      <p className="mt-1 text-sm text-muted">
        {statusLabel(booking.status)} · booked {created}
      </p>
      <p className="mt-3 text-sm text-muted">{statusDetail(booking.status, booking.urgency)}</p>

      {query.paid === "1" ? (
        <p className="mt-4 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-navy">
          Checkout finished. The receipt flips to paid when the Stripe webhook confirms it — this
          page does not trust the redirect alone.
        </p>
      ) : null}
      {query.canceled === "1" ? (
        <p className="mt-4 rounded-xl border border-gold/40 bg-gold/15 px-4 py-3 text-sm text-navy">
          Checkout canceled. The amount is still owed to Trades on Demand.
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-line bg-paper p-5 text-sm">
        <dl className="space-y-3">
          <Row label="Job ID" value={booking.publicId} mono />
          <Row label="Status" value={statusLabel(booking.status)} />
          <Row label="Urgency" value={booking.urgency} />
          <Row
            label="Job site"
            value={`${booking.street}, ${booking.city}, ${booking.state} ${booking.zip}`}
          />
          <Row
            label="Contractor"
            value={booking.contractor?.businessName ?? "First available match"}
          />
          <Row label="Quote" value={booking.quoteSummary} />
          <Row label="Problem" value={booking.problem} />
        </dl>
      </div>

      {invoice ? (
        <section className="mt-8 rounded-2xl border border-line bg-paper p-5">
          <h3 className="font-display text-2xl text-navy">Invoice</h3>
          <p className="mt-1 text-sm text-muted">
            Time and materials from {booking.contractor?.businessName ?? "your contractor"}. Pay the
            remaining balance to Trades on Demand.
          </p>
          <div className="mt-4">
            <InvoiceBreakdown
              publicId={invoice.publicId}
              status={invoice.status}
              lines={invoice.lines}
              laborCents={invoice.laborCents}
              materialsCents={invoice.materialsCents}
              subtotalCents={invoice.subtotalCents}
              customerSubtotalCents={invoice.customerSubtotalCents}
              markupCents={invoice.markupCents}
              depositPaidCents={invoice.depositPaidCents}
              amountDueCents={invoice.amountDueCents}
              note={invoice.note}
              variant="customer"
            />
          </div>
          {invoicePayable ? (
            <div className="mt-4">
              <AccountPayButton
                jobId={booking.publicId}
                paymentId={invoicePayable.id}
                label={`Pay invoice balance ${formatUsd(invoicePayable.amountCents)} to TOD`}
              />
            </div>
          ) : invoice.amountDueCents === 0 ? (
            <p className="mt-3 text-sm text-ok">
              The deposit already covers this invoice. Nothing more is owed to TOD.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8">
        <h3 className="font-display text-2xl text-navy">Pay Trades on Demand</h3>
        <p className="mt-1 text-sm text-muted">
          Deposits and balances are charged to TOD (Trademark Walls). The contractor is not the
          merchant of record.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-ember/10 px-3 py-1 text-navy">
            Owed {formatUsd(totals.pendingCents)}
          </span>
          <span className="rounded-full bg-ok/10 px-3 py-1 text-navy">
            Paid {formatUsd(totals.paidCents)}
          </span>
          {totals.refundedCents > 0 ? (
            <span className="rounded-full bg-cream-2 px-3 py-1 text-navy">
              Refunded {formatUsd(totals.refundedCents)}
            </span>
          ) : null}
        </div>

        <ul className="mt-4 space-y-3">
          {booking.payments.length === 0 ? (
            <li className="text-sm text-muted">No TOD charges on this ticket yet.</li>
          ) : (
            booking.payments.map((payment) => (
              <li key={payment.id} className="rounded-xl border border-line bg-paper px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted">{payment.publicId}</p>
                    <p className="text-sm text-navy">{customerPaymentLine(payment)}</p>
                    {payment.note ? <p className="mt-1 text-xs text-muted">{payment.note}</p> : null}
                    {payment.stripeCheckoutSessionId ? (
                      <p className="mt-1 font-mono text-[0.7rem] text-muted">
                        {payment.stripeCheckoutSessionId}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-right font-semibold text-navy">{formatUsd(payment.amountCents)}</p>
                </div>
                {payable.some((row) => row.id === payment.id) ? (
                  <div className="mt-3">
                    <AccountPayButton
                      jobId={booking.publicId}
                      paymentId={payment.id}
                      label={`Pay ${formatUsd(payment.amountCents)} to TOD`}
                    />
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <ol className="mt-8 space-y-3">
        {booking.events.map((event, index) => (
          <li key={event.id} className="flex gap-3">
            <span
              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                index === booking.events.length - 1 ? "bg-ember" : "bg-navy"
              }`}
            />
            <div>
              <p className="font-medium text-navy">{statusLabel(event.status)}</p>
              <p className="text-xs text-muted">
                {new Date(event.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                {event.note ? ` · ${event.note}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/status/${booking.token}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-navy"
        >
          Public job status
        </Link>
        <Link href="/account" className="inline-flex h-11 items-center justify-center text-sm font-semibold text-navy">
          All jobs
        </Link>
      </div>
    </AccountShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="stamp text-[0.65rem] text-muted">{label}</dt>
      <dd className={`mt-1 text-navy ${mono ? "font-mono text-xs" : ""} ${label === "Urgency" ? "capitalize" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
