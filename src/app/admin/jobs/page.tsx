import Link from "next/link";
import { AdminAssignContractor } from "@/components/admin/AdminAssignContractor";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminJobAssignCard } from "@/components/admin/AdminJobAssignCard";
import { AdminJobStatus } from "@/components/admin/AdminJobStatus";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchNeedle } from "@/lib/admin";
import { BOOKING_STATUSES, statusLabel } from "@/lib/booking";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { parseTradesJson } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { invoiceStatusLabel } from "@/lib/invoice";
import { loadBookingInvoiceSummaries, type BookingInvoiceSummary } from "@/lib/invoice-columns";
import { formatUsd } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminGate>
      <JobsList
        q={searchNeedle(params.q)}
        status={params.status ?? "ALL"}
        deleted={searchNeedle(params.deleted)}
      />
    </AdminGate>
  );
}

async function JobsList({ q, status, deleted }: { q: string; status: string; deleted: string }) {
  if (!(await isOpsAuthenticated())) return null;
  const [jobs, approved] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ...(status !== "ALL" ? { status } : {}),
        ...(q
          ? {
              OR: [
                { publicId: { contains: q, mode: "insensitive" } },
                { customerName: { contains: q, mode: "insensitive" } },
                { customerEmail: { contains: q, mode: "insensitive" } },
                { customerPhone: { contains: q.replace(/\D/g, "") || q } },
                { city: { contains: q, mode: "insensitive" } },
                { zip: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { contractor: true, customer: true },
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
  const invoices = await loadBookingInvoiceSummaries(jobs.map((job) => job.id));

  return (
    <div>
      <p className="stamp text-xs text-ember">Dispatch</p>
      <h1 className="font-display text-3xl text-navy">Jobs</h1>
      <p className="mt-2 text-sm text-muted">
        Assign each job to an approved subcontractor with the picker on the card. Reassignment asks
        for confirmation. The shop then sees the ticket under /contractor. Delete a job from its
        detail page after typing the job ID.
      </p>
      {deleted ? (
        <p className="mt-4 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-navy">
          {deleted} was deleted. Status history, client SMS, and any pending or refunded invoices on
          that ticket are gone.
        </p>
      ) : null}
      <AdminSearch
        action="/admin/jobs"
        q={q}
        placeholder="Search job ID, client, phone, city, or ZIP"
        extra={
          <label className="text-sm">
            <span className="sr-only">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            >
              <option value="ALL">All statuses</option>
              {BOOKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {jobs.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          No jobs match.
        </p>
      ) : (
        <>
      <div className="mt-6 space-y-3">
        {jobs.map((job) => (
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
            invoice={invoices.get(job.id) ?? null}
          />
        ))}
      </div>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Trade / site</th>
                <th className="px-4 py-3 font-medium">Subcontractor</th>
                <th className="px-4 py-3 font-medium">Assign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-line/70 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/jobs/${job.id}`} className="font-mono text-xs font-semibold text-ember hover:underline">
                      {job.publicId}
                    </Link>
                    <p className="text-xs text-muted">{job.urgency}</p>
                  </td>
                  <td className="px-4 py-3">
                    {job.customer ? (
                      <Link href={`/admin/clients/${job.customer.id}`} className="font-semibold text-navy hover:underline">
                        {job.customer.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-navy">{job.customerName}</span>
                    )}
                    <p className="text-xs text-muted">{formatPhone(job.customerPhone)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{getTrade(job.trade)?.name ?? job.trade}</p>
                    <p className="text-xs text-muted">
                      {job.city}, {job.state} {job.zip}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {job.contractor ? (
                      <Link
                        href={`/admin/contractors/${job.contractor.id}`}
                        className="text-navy hover:underline"
                      >
                        {job.contractor.businessName}
                      </Link>
                    ) : (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-[16rem]">
                    <AdminAssignContractor
                      bookingId={job.id}
                      trade={job.trade}
                      currentContractorId={job.contractorId}
                      currentContractorName={job.contractor?.businessName ?? null}
                      contractors={contractors}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <AdminJobStatus id={job.id} status={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    <JobBalanceLink jobId={job.id} invoice={invoices.get(job.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/jobs/${job.id}#delete`}
                      className="text-sm font-semibold text-danger hover:underline"
                    >
                      Delete
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
        </>
      )}
    </div>
  );
}

function JobBalanceLink({
  jobId,
  invoice,
}: {
  jobId: string;
  invoice?: BookingInvoiceSummary;
}) {
  if (!invoice) return <span className="text-muted">—</span>;
  return (
    <Link href={`/admin/jobs/${jobId}#invoice`} className="font-semibold text-ember hover:underline">
      {formatUsd(invoice.amountDueCents)}
      <span className="mt-0.5 block text-xs font-normal text-muted">
        {invoiceStatusLabel(invoice.status)} · customer
      </span>
    </Link>
  );
}
