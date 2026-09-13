import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorJobCard } from "@/components/contractor-app/ContractorJobCard";
import { ContractorLogin } from "@/components/contractor-app/ContractorLogin";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { isPastContractorJob } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContractorPastJobsPage() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) return <ContractorLogin />;

  const rows = await prisma.booking.findMany({
    where: { contractorId: contractor.id },
    orderBy: { updatedAt: "desc" },
    omit: BOOKING_SMS_OMIT,
  });
  const past = rows.filter((job) => isPastContractorJob(job.status));

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <h1 className="font-display text-2xl text-navy">Past jobs</h1>
      <p className="mt-1 text-sm text-muted">Completed and cancelled tickets assigned to your shop.</p>

      {past.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-muted">
          No completed or cancelled jobs yet. Finished work lands here after you mark it done.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {past.map((job) => (
            <ContractorJobCard key={job.id} {...job} revealCustomer problem={job.problem} />
          ))}
        </ul>
      )}
    </ContractorAppShell>
  );
}
