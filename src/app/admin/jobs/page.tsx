import Link from "next/link";
import { AdminAssignContractor } from "@/components/admin/AdminAssignContractor";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminJobStatus } from "@/components/admin/AdminJobStatus";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchNeedle } from "@/lib/admin";
import { BOOKING_STATUSES, statusLabel } from "@/lib/booking";
import { parseTradesJson } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminGate>
      <JobsList q={searchNeedle(params.q)} status={params.status ?? "ALL"} />
    </AdminGate>
  );
}

async function JobsList({ q, status }: { q: string; status: string }) {
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

  return (
    <div>
      <p className="stamp text-xs text-ember">Dispatch</p>
      <h1 className="font-display text-3xl text-navy">Jobs</h1>
      <p className="mt-2 text-sm text-muted">
        Overview of bookings. Open a job to assign a licensed subcontractor, or pick one in the list.
      </p>
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
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Trade / site</th>
                <th className="px-4 py-3 font-medium">Subcontractor</th>
                <th className="px-4 py-3 font-medium">Assign</th>
                <th className="px-4 py-3 font-medium">Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
