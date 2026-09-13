import Link from "next/link";
import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorLogin } from "@/components/contractor-app/ContractorLogin";
import { jobFitsContractor } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { statusLabel } from "@/lib/booking";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function ContractorHomePage() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) return <ContractorLogin />;

  const [assigned, open] = await Promise.all([
    prisma.booking.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.findMany({
      where: {
        contractorId: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const available = open.filter((job) => jobFitsContractor(job, contractor));

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <h1 className="font-display text-2xl text-navy">Jobs</h1>
      <p className="mt-1 text-sm text-muted">Assigned to you, plus open tickets in your trades and area.</p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Assigned</h2>
        {assigned.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            No assigned jobs yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {assigned.map((job) => (
              <JobRow key={job.id} {...job} revealCustomer problem={job.problem} />
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
              <JobRow key={job.id} {...job} revealCustomer={false} problem={job.problem} />
            ))}
          </ul>
        )}
      </section>
    </ContractorAppShell>
  );
}

function JobRow({
  id,
  publicId,
  trade,
  urgency,
  city,
  zip,
  customerName,
  customerPhone,
  status,
  revealCustomer,
  problem,
}: {
  id: string;
  publicId: string;
  trade: string;
  urgency: string;
  city: string;
  zip: string;
  customerName: string;
  customerPhone: string;
  status: string;
  revealCustomer: boolean;
  problem?: string;
}) {
  return (
    <li>
      <Link href={`/contractor/jobs/${id}`} className="block rounded-2xl border border-line bg-paper p-4">
        <p className="font-mono text-xs text-muted">{publicId}</p>
        <p className="font-display text-xl text-navy">{getTrade(trade)?.name ?? trade}</p>
        <p className="text-sm text-muted">
          {urgency} · {city} {zip} · {statusLabel(status)}
        </p>
        {revealCustomer ? (
          <p className="mt-1 text-sm text-navy">
            {customerName} · {formatPhone(customerPhone)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-navy">
            {problem ? (problem.length > 140 ? `${problem.slice(0, 137)}…` : problem) : "Neighborhood / ZIP only until you accept."}
          </p>
        )}
      </Link>
    </li>
  );
}
