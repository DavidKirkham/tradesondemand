import type { Metadata } from "next";
import Link from "next/link";
import { AccountEditor } from "@/components/account/AccountEditor";
import { AccountLogin } from "@/components/account/AccountLogin";
import { AccountSignOut } from "@/components/account/AccountSignOut";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { formatUsd } from "@/lib/money";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/booking";
import { getTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await getCustomerFromCookie();
  if (!customer) return <AccountLogin />;

  const [bookings, payments] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: { contractor: true },
    }),
    prisma.payment.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: { booking: true },
    }),
  ]);

  const addresses = Array.from(
    new Map(
      bookings.map((booking) => [
        `${booking.street}|${booking.city}|${booking.state}|${booking.zip}`,
        booking,
      ]),
    ).values(),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="stamp text-xs text-ember">Private customer profile</p>
          <h1 className="mt-2 font-display text-4xl text-navy">My jobs</h1>
        </div>
        <AccountSignOut />
      </div>
      <p className="mt-3 text-sm text-muted">
        Only you and the KC ops desk can see this. Contractors on an assigned job get your name,
        phone, and that job address — never a public listing. You pay Trades on Demand, not the
        contractor.
      </p>

      <h2 className="mt-10 font-display text-2xl text-navy">Contact</h2>
      <div className="mt-4">
        <AccountEditor
          name={customer.name}
          email={customer.email}
          phone={customer.phone}
          preferredContact={customer.preferredContact}
        />
      </div>

      <h2 className="mt-10 font-display text-2xl text-navy">Service addresses</h2>
      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Addresses appear after you book a KC job.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-navy">
          {addresses.map((row, index) => (
            <li key={row.id} className="rounded-xl border border-line bg-paper px-4 py-3">
              {index === 0 ? <p className="stamp mb-1 text-[0.65rem] text-muted">Most recent</p> : null}
              {row.street}, {row.city}, {row.state} {row.zip}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-display text-2xl text-navy">Bookings</h2>
      {bookings.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-8 text-sm text-muted">
          No jobs yet. Book a KC metro trade and it will show up here with a status link.
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        {bookings.map((booking) => (
          <article key={booking.id} className="rounded-2xl border border-line bg-paper p-4">
            <p className="font-mono text-xs text-muted">{booking.publicId}</p>
            <p className="font-display text-xl text-navy">{getTrade(booking.trade)?.name ?? booking.trade}</p>
            <p className="text-sm text-muted">
              {statusLabel(booking.status)}
              {booking.contractor ? ` · ${booking.contractor.businessName}` : " · first available"}
            </p>
            <Link href={`/status/${booking.token}`} className="mt-2 inline-block text-sm font-semibold text-ember">
              Job status
            </Link>
          </article>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl text-navy">TOD receipts</h2>
      <p className="mt-1 text-sm text-muted">Payments are collected by Trades on Demand, then we pay the partner.</p>
      {payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Receipts appear after a TOD deposit or job balance.</p>
      ) : null}
      <div className="mt-3 space-y-2">
        {payments.map((payment) => (
          <div key={payment.id} className="flex justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm">
            <div>
              <p className="font-mono text-xs text-muted">{payment.publicId}</p>
              <p className="text-navy">
                {paymentTypeLabel(payment.type)} · {payment.booking.publicId}
              </p>
            </div>
            <p className="text-right text-navy">
              {formatUsd(payment.amountCents)}
              <span className="mt-1 block text-xs text-muted">{paymentStatusLabel(payment.status)}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
