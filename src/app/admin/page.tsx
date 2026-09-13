import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminJobAssignCard } from "@/components/admin/AdminJobAssignCard";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { contractorStatusLabel, parseTradesJson } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  return (
    <AdminGate>
      <AdminOverview />
    </AdminGate>
  );
}

async function AdminOverview() {
  if (!(await isOpsAuthenticated())) return null;
  const [clientCount, contractorGroups, jobCount, pendingContractors, recentClients, unassigned, approved] =
    await Promise.all([
      prisma.customer.count(),
      prisma.contractor.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.booking.count(),
      prisma.contractor.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { _count: { select: { bookings: true } } },
      }),
      prisma.booking.findMany({
        where: { contractorId: null, status: { notIn: ["CANCELLED", "COMPLETED"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: true, contractor: true },
        omit: BOOKING_SMS_OMIT,
      }),
      prisma.contractor.findMany({
        where: { status: "APPROVED" },
        orderBy: { businessName: "asc" },
      }),
    ]);
  const contractors = approved.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    publicId: row.publicId,
    trades: parseTradesJson(row.tradesJson),
  }));

  const byStatus = Object.fromEntries(contractorGroups.map((row) => [row.status, row._count._all]));

  return (
    <div>
      <p className="stamp text-xs text-ember">Owner backend</p>
      <h1 className="font-display text-3xl text-navy">Clients &amp; subcontractors</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Private records only. Assign a job to an approved subcontractor here or under{" "}
        <Link href="/admin/jobs" className="font-semibold text-ember">
          Jobs
        </Link>
        . Approve shops before they show on /contractors.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat href="/admin/clients" label="Clients" value={clientCount} />
        <Stat
          href="/admin/contractors"
          label="Subcontractors"
          value={`${byStatus.PENDING ?? 0} pending · ${byStatus.APPROVED ?? 0} live`}
        />
        <Stat href="/admin/jobs" label="Jobs" value={jobCount} />
      </div>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-navy">Assign a job to a subcontractor</h2>
          <Link href="/admin/jobs" className="text-sm font-semibold text-ember">
            All jobs
          </Link>
        </div>
        {unassigned.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            No unassigned open jobs. Open any job under Jobs to reassign it to another approved shop.
          </p>
        ) : (
          unassigned.map((job) => (
            <AdminJobAssignCard
              key={job.id}
              id={job.id}
              publicId={job.publicId}
              trade={job.trade}
              city={job.city}
              state={job.state}
              zip={job.zip}
              status={job.status}
              urgency={job.urgency}
              customerName={job.customer?.name ?? job.customerName}
              contractorId={job.contractorId}
              contractorName={job.contractor?.businessName ?? null}
              contractors={contractors}
            />
          ))
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-navy">Recent clients</h2>
            <Link href="/admin/clients" className="text-sm font-semibold text-ember">
              All clients
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No clients yet. Profiles are created on first book.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {recentClients.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-2">
                  <Link href={`/admin/clients/${row.id}`} className="font-semibold text-navy hover:underline">
                    {row.name}
                  </Link>
                  <span className="text-muted">{row._count.bookings} jobs</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-navy">Pending subcontractors</h2>
            <Link href="/admin/contractors?status=PENDING" className="text-sm font-semibold text-ember">
              Review queue
            </Link>
          </div>
          {pendingContractors.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No applications waiting.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {pendingContractors.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/admin/contractors/${row.id}`}
                    className="font-semibold text-navy hover:underline"
                  >
                    {row.businessName}
                  </Link>
                  <span className="text-muted">{contractorStatusLabel(row.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ href, label, value }: { href: string; label: string; value: string | number }) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-paper p-4 hover:border-navy/30">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl text-navy">{value}</p>
    </Link>
  );
}
