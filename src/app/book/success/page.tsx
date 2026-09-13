import type { Metadata } from "next";
import Link from "next/link";
import { formatUsd } from "@/lib/money";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function BookSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; session_id?: string }>;
}) {
  const { token, session_id: sessionId } = await searchParams;
  const booking = token
    ? await prisma.booking.findFirst({
        where: { OR: [{ token }, { publicId: token }] },
        include: { payments: { orderBy: { createdAt: "desc" } } },
      })
    : sessionId
      ? await prisma.booking.findFirst({
          where: { payments: { some: { stripeCheckoutSessionId: sessionId } } },
          include: { payments: { orderBy: { createdAt: "desc" } } },
        })
      : null;

  const payment = booking?.payments[0];
  const paid = payment?.status === "PAID";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="stamp text-xs text-ok">You pay Trades on Demand</p>
      <h1 className="mt-2 font-display text-4xl text-navy">
        {paid ? "Deposit received" : "Confirming your TOD payment"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Payments are processed by Trademark Walls for Trades on Demand. The contractor is not the
        merchant of record and never sees your card. Status updates when the Stripe webhook marks
        the payment paid — we do not trust this redirect alone.
      </p>
      {booking ? (
        <div className="mt-6 rounded-2xl border border-line bg-paper p-5 text-sm">
          <p className="font-mono text-xs text-muted">{booking.publicId}</p>
          {payment ? (
            <>
              <p className="mt-2 text-navy">
                {paymentTypeLabel(payment.type)} · {formatUsd(payment.amountCents)} ·{" "}
                {paymentStatusLabel(payment.status)}
              </p>
              {payment.stripeCheckoutSessionId ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  Session {payment.stripeCheckoutSessionId}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">We could not match that checkout session yet.</p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {booking ? (
          <Link
            href={`/status/${booking.token}`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
          >
            View job status
          </Link>
        ) : null}
        <Link href="/account" className="inline-flex h-12 items-center justify-center text-sm font-semibold text-navy">
          My profile / receipts
        </Link>
      </div>
    </div>
  );
}
