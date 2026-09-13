import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallButton } from "@/components/CallButton";
import { statusDetail, statusLabel } from "@/lib/booking";
import { InvoiceBreakdown } from "@/components/invoice/InvoiceBreakdown";
import { customerCanSeeInvoice } from "@/lib/invoice";
import { loadBookingInvoice } from "@/lib/invoice-columns";
import { formatUsd } from "@/lib/money";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Job status",
};

export const dynamic = "force-dynamic";

export default async function StatusDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ token }, { publicId: token }] },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      contractor: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) notFound();

  const invoiceRecord = await loadBookingInvoice(booking.id);
  const invoice =
    invoiceRecord && customerCanSeeInvoice(invoiceRecord.status) ? invoiceRecord : null;
  const trade = getTrade(booking.trade);
  const contractorLabel = booking.contractor
    ? booking.contractor.businessName
    : booking.matchPreference === "SPECIFIC"
      ? "Requested partner"
      : "First available match";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="stamp text-xs text-ember">{booking.publicId}</p>
      <h1 className="mt-2 font-display text-4xl text-navy">{statusLabel(booking.status)}</h1>
      <p className="mt-3 text-muted">{statusDetail(booking.status, booking.urgency)}</p>

      <div className="mt-8 rounded-2xl border border-line bg-paper p-6">
        <dl className="space-y-3 text-sm">
          <Row label="Trade" value={trade?.name ?? booking.trade} />
          <div>
            <dt className="stamp text-[0.65rem] text-muted">Contractor</dt>
            <dd className="mt-1 text-navy">
              {booking.contractor ? (
                <Link href={`/contractors/${booking.contractor.slug}`} className="font-medium text-ember">
                  {booking.contractor.businessName}
                </Link>
              ) : (
                contractorLabel
              )}
            </dd>
          </div>
          <Row label="Urgency" value={booking.urgency} />
          <Row
            label="Job site"
            value={`${booking.street}, ${booking.city}, ${booking.state} ${booking.zip}`}
          />
          <Row label="Quote" value={booking.quoteSummary} />
          <Row label="Problem" value={booking.problem} />
        </dl>
        {booking.payments.length > 0 ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="stamp text-[0.65rem] text-muted">You pay Trades on Demand</p>
            <ul className="mt-2 space-y-2 text-sm text-navy">
              {booking.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3">
                  <span>
                    {paymentTypeLabel(payment.type)} · {payment.publicId}
                    {payment.stripeCheckoutSessionId ? (
                      <span className="mt-0.5 block font-mono text-[0.7rem] text-muted">
                        {payment.stripeCheckoutSessionId}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right">
                    {formatUsd(payment.amountCents)}
                    <span className="mt-0.5 block text-xs text-muted">
                      {paymentStatusLabel(payment.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Processed by Trademark Walls for Trades on Demand. The contractor never sees your card.
            </p>
          </div>
        ) : null}
        {invoice ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="stamp text-[0.65rem] text-muted">Invoice</p>
            <div className="mt-2">
              <InvoiceBreakdown
                publicId={invoice.publicId}
                status={invoice.status}
                lines={invoice.lines}
                laborCents={invoice.laborCents}
                materialsCents={invoice.materialsCents}
                subtotalCents={invoice.subtotalCents}
                depositPaidCents={invoice.depositPaidCents}
                amountDueCents={invoice.amountDueCents}
                note={invoice.note}
              />
            </div>
            {invoice.amountDueCents > 0 ? (
              <p className="mt-2 text-xs text-muted">
                Sign in at /account to pay the remaining balance to Trades on Demand.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

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
        <CallButton />
        <Link href="/status" className="inline-flex h-11 items-center justify-center text-sm font-semibold text-navy">
          Look up another job
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stamp text-[0.65rem] text-muted">{label}</dt>
      <dd className={`mt-1 text-navy ${label === "Urgency" ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}
