import type { Metadata } from "next";
import Link from "next/link";
import { AccountJobCard } from "@/components/account/AccountJobCard";
import { AccountShell } from "@/components/account/AccountShell";
import { requireCustomer } from "@/lib/customer-auth";
import { customerPaymentTotals, partitionCustomerJobs } from "@/lib/customer-jobs";
import { formatUsd } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "My jobs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await requireCustomer("/account");
  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: { contractor: true, payments: true },
  });
  const { current, past } = partitionCustomerJobs(bookings);
  const totals = customerPaymentTotals(bookings.flatMap((booking) => booking.payments));

  return (
    <AccountShell name={customer.name} needsPassword={!customer.passwordHash}>
      <p className="text-sm text-muted">
        Only you and the KC ops desk can see this. You pay Trades on Demand, not the contractor.
      </p>

      {totals.pendingCents > 0 ? (
        <div className="mt-4 rounded-2xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-navy">
          <p className="font-semibold">Outstanding with TOD: {formatUsd(totals.pendingCents)}</p>
          <p className="mt-1 text-muted">
            Open a job to pay a pending deposit or balance through Stripe Checkout.
          </p>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-2xl text-navy">Current jobs</h2>
        {current.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-8 text-sm text-muted">
            No open tickets.{" "}
            <Link href="/book" className="font-semibold text-ember">
              Book a KC metro trade
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {current.map((booking) => (
              <AccountJobCard
                key={booking.id}
                publicId={booking.publicId}
                trade={booking.trade}
                status={booking.status}
                createdAt={booking.createdAt}
                city={booking.city}
                state={booking.state}
                zip={booking.zip}
                contractorName={booking.contractor?.businessName}
                payments={booking.payments}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-navy">Past jobs</h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Completed and cancelled jobs will land here.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {past.map((booking) => (
              <AccountJobCard
                key={booking.id}
                publicId={booking.publicId}
                trade={booking.trade}
                status={booking.status}
                createdAt={booking.createdAt}
                city={booking.city}
                state={booking.state}
                zip={booking.zip}
                contractorName={booking.contractor?.businessName}
                payments={booking.payments}
              />
            ))}
          </div>
        )}
      </section>
    </AccountShell>
  );
}
