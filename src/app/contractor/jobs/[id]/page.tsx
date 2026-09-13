import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorJobActions } from "@/components/contractor-app/ContractorJobActions";
import { ContractorLogin } from "@/components/contractor-app/ContractorLogin";
import { statusLabel } from "@/lib/booking";
import { BOOKING_SMS_OMIT, isMissingBookingSmsColumn } from "@/lib/booking-sms-columns";
import { jobFitsContractor } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { formatPhone, telHref } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function ContractorJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) return <ContractorLogin />;

  const { id } = await params;
  const job = await prisma.booking.findUnique({ where: { id }, omit: BOOKING_SMS_OMIT });
  if (!job) notFound();

  let smsStatus: string | null = null;
  try {
    const sms = await prisma.booking.findUnique({
      where: { id },
      select: { customerSmsStatus: true },
    });
    smsStatus = sms?.customerSmsStatus ?? null;
  } catch (error) {
    if (!isMissingBookingSmsColumn(error)) throw error;
  }

  const assigned = job.contractorId === contractor.id;
  const available = !job.contractorId && jobFitsContractor(job, contractor);
  if (!assigned && !available) notFound();

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <Link href="/contractor" className="text-sm font-semibold text-ember">
        ← Jobs
      </Link>
      <p className="mt-3 font-mono text-xs text-muted">{job.publicId}</p>
      <h1 className="font-display text-3xl text-navy">{getTrade(job.trade)?.name ?? job.trade}</h1>
      <p className={`mt-1 text-sm font-semibold ${job.urgency === "emergency" ? "text-ember" : "text-navy"}`}>
        {job.urgency} · {statusLabel(job.status)}
      </p>

      <section className="mt-5 rounded-2xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Site</h2>
        {assigned ? (
          <p className="mt-1 text-navy">
            {job.street}
            <br />
            {job.city}, {job.state} {job.zip}
          </p>
        ) : (
          <p className="mt-1 text-navy">
            {job.city}, {job.state} {job.zip}
            <span className="mt-1 block text-sm text-muted">Full street after you accept.</span>
          </p>
        )}
      </section>

      {assigned ? (
        <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Customer</h2>
          <p className="mt-1 font-semibold text-navy">{job.customerName}</p>
          <a href={telHref(job.customerPhone)} className="text-sm font-semibold text-ember">
            {formatPhone(job.customerPhone)}
          </a>
          <p className="text-sm text-muted">{job.customerEmail}</p>
        </section>
      ) : (
        <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Customer</h2>
          <p className="mt-1 text-sm text-muted">Contact is available after you accept. The desk texts them for you.</p>
        </section>
      )}

      <section className="mt-3 rounded-2xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Problem</h2>
        <p className="mt-1 text-navy">{job.problem}</p>
      </section>

      <p className="mt-4 text-xs text-muted">
        Customers pay Trades on Demand. Do not take a card or cash as TOD payment.
      </p>

      <div className="mt-4">
        <ContractorJobActions
          id={job.id}
          status={job.status}
          assigned={assigned}
          smsStatus={smsStatus}
        />
      </div>
    </ContractorAppShell>
  );
}
