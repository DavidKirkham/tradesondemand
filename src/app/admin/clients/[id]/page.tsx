import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAddressEditor } from "@/components/admin/AdminAddressEditor";
import { AdminAssignContractor } from "@/components/admin/AdminAssignContractor";
import { AdminClientDelete } from "@/components/admin/AdminClientDelete";
import { AdminClientEditor } from "@/components/admin/AdminClientEditor";
import { AdminCopyPayLink } from "@/components/admin/AdminCopyPayLink";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminJobStatus } from "@/components/admin/AdminJobStatus";
import { AdminPaymentStatus } from "@/components/admin/AdminPaymentStatus";
import { statusLabel } from "@/lib/booking";
import { isPastContractorJob } from "@/lib/contractor-app";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { parseTradesJson } from "@/lib/contractor";
import { customerPaymentLine, outstandingCustomerJobPays } from "@/lib/customer-jobs";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { formatUsd } from "@/lib/money";
import { paymentTypeLabel } from "@/lib/payments";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminGate>
      <ClientDetail id={id} />
    </AdminGate>
  );
}

async function ClientDetail({ id }: { id: string }) {
  if (!(await isOpsAuthenticated())) return null;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { contractor: true, payments: true },
        omit: BOOKING_SMS_OMIT,
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { booking: { omit: BOOKING_SMS_OMIT } },
      },
    },
  });
  if (!customer) notFound();

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
  const outstanding = outstandingCustomerJobPays(customer.bookings);
  const outstandingCents = outstanding.reduce((sum, job) => sum + job.pendingCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm font-semibold text-ember">
          ← Clients
        </Link>
        <h1 className="mt-2 font-display text-3xl text-navy">{customer.name}</h1>
        <p className="text-sm text-muted">
          {customer.email} · {formatPhone(customer.phone)} · private client record
        </p>
      </div>

      <AdminClientEditor
        id={customer.id}
        name={customer.name}
        email={customer.email}
        phone={customer.phone}
        preferredContact={customer.preferredContact}
      />

      <section>
        <h2 className="font-display text-2xl text-navy">Addresses from jobs</h2>
        <p className="mt-1 text-sm text-muted">Job-site addresses live on bookings, not a public profile.</p>
        {customer.bookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No job addresses yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {customer.bookings.map((booking) => (
              <AdminAddressEditor
                key={booking.id}
                bookingId={booking.id}
                publicId={booking.publicId}
                street={booking.street}
                city={booking.city}
                state={booking.state}
                zip={booking.zip}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-navy">Booking history</h2>
          <Link href="/admin/jobs" className="text-sm font-semibold text-ember">
            All jobs
          </Link>
        </div>
        {customer.bookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No jobs.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Trade</th>
                  <th className="px-4 py-3 font-medium">Subcontractor</th>
                  <th className="px-4 py-3 font-medium">Assign</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/admin/jobs/${booking.id}`} className="font-semibold text-ember">
                        {booking.publicId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{getTrade(booking.trade)?.name ?? booking.trade}</td>
                    <td className="px-4 py-3">
                      {booking.contractor ? (
                        <Link href={`/admin/contractors/${booking.contractor.id}`} className="text-navy hover:underline">
                          {booking.contractor.businessName}
                        </Link>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[16rem]">
                      <AdminAssignContractor
                        bookingId={booking.id}
                        trade={booking.trade}
                        currentContractorId={booking.contractorId}
                        currentContractorName={booking.contractor?.businessName ?? null}
                        contractors={contractors}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <AdminJobStatus id={booking.id} status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="pay">
        <h2 className="font-display text-2xl text-navy">Pay links</h2>
        <p className="mt-1 text-sm text-muted">
          Share the customer portal job page. They sign in as themselves and pay TOD through Stripe
          Checkout — the webhook remains the source of truth.
        </p>
        {outstanding.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing is owed to TOD right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm font-semibold text-navy">
              Outstanding with TOD: {formatUsd(outstandingCents)}
            </p>
            <ul className="space-y-3">
            {outstanding.map((job) => (
              <li
                key={job.jobPublicId}
                className="rounded-xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted">{job.jobPublicId}</p>
                    <ul className="mt-1 space-y-1 text-navy">
                      {job.payments.map((payment) => (
                        <li key={payment.id}>
                          {formatUsd(payment.amountCents)} · {customerPaymentLine(payment)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="font-semibold text-navy">{formatUsd(job.pendingCents)}</p>
                </div>
                <div className="mt-3">
                  <AdminCopyPayLink path={job.payPath} />
                </div>
              </li>
            ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-navy">TOD payments</h2>
        {customer.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No receipts yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {customer.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-navy">
                    {formatUsd(payment.amountCents)} · {paymentTypeLabel(payment.type)}
                  </p>
                  <p className="text-muted">
                    {payment.booking.publicId} · {statusLabel(payment.booking.status)}
                  </p>
                </div>
                <AdminPaymentStatus id={payment.id} status={payment.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminClientDelete
        id={customer.id}
        name={customer.name}
        activeJobs={customer.bookings
          .filter((booking) => !isPastContractorJob(booking.status))
          .map((booking) => ({
            id: booking.id,
            publicId: booking.publicId,
            status: booking.status,
          }))}
        closedJobCount={customer.bookings.filter((booking) => isPastContractorJob(booking.status)).length}
      />
    </div>
  );
}
