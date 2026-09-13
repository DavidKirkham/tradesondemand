import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorJobCard } from "@/components/contractor-app/ContractorJobCard";
import { ContractorLogin } from "@/components/contractor-app/ContractorLogin";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { isOpenContractorJob, jobFitsContractor } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContractorHomePage() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) return <ContractorLogin />;

  const [assignedRows, open] = await Promise.all([
    prisma.booking.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: "desc" },
      omit: BOOKING_SMS_OMIT,
    }),
    prisma.booking.findMany({
      where: {
        contractorId: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      omit: BOOKING_SMS_OMIT,
    }),
  ]);

  const assigned = assignedRows.filter((job) => isOpenContractorJob(job.status));
  const available = open.filter((job) => jobFitsContractor(job, contractor));

  return (
    <ContractorAppShell businessName={contractor.businessName} availableCount={available.length}>
      <h1 className="font-display text-2xl text-navy">Current jobs</h1>
      <p className="mt-1 text-sm text-muted">Assigned open tickets, plus jobs in your trades and area.</p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Assigned</h2>
        {assigned.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            No open assigned jobs. Check available tickets or Past for closed work.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {assigned.map((job) => (
              <ContractorJobCard key={job.id} {...job} revealCustomer problem={job.problem} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Available</h2>
        {available.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            No open jobs in your coverage right now.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {available.map((job) => (
              <ContractorJobCard key={job.id} {...job} revealCustomer={false} problem={job.problem} />
            ))}
          </ul>
        )}
      </section>
    </ContractorAppShell>
  );
}
