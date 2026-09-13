import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAddressEditor } from "@/components/admin/AdminAddressEditor";
import { AdminClientEditor } from "@/components/admin/AdminClientEditor";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminJobStatus } from "@/components/admin/AdminJobStatus";
import { AdminPaymentStatus } from "@/components/admin/AdminPaymentStatus";
import { statusLabel } from "@/lib/booking";
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
      },
      payments: { orderBy: { createdAt: "desc" }, include: { booking: true } },
    },
  });
  if (!customer) notFound();

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
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/admin/jobs?q=${booking.publicId}`} className="font-semibold text-ember">
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
                        <span className="text-muted">First available</span>
                      )}
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
    </div>
  );
}
