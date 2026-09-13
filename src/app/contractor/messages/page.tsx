import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorLogin } from "@/components/contractor-app/ContractorLogin";
import { ContractorSmsForm } from "@/components/contractor-app/ContractorSmsForm";
import { statusLabel } from "@/lib/booking";
import { BOOKING_SMS_OMIT, withOptionalBookingSmsColumns } from "@/lib/booking-sms-columns";
import { isOpenContractorJob } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SmsJob = {
  id: string;
  publicId: string;
  trade: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerSmsStatus?: string | null;
};

export default async function ContractorMessagesPage() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) return <ContractorLogin />;

  const rows = await withOptionalBookingSmsColumns((omitSms) =>
    prisma.booking.findMany({
      where: { contractorId: contractor.id },
      orderBy: { updatedAt: "desc" },
      ...(omitSms ? { omit: BOOKING_SMS_OMIT } : {}),
    }),
  );

  const jobs = rows as SmsJob[];
  const open = jobs.filter((job) => isOpenContractorJob(job.status));
  const closed = jobs.filter((job) => !isOpenContractorJob(job.status));

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <h1 className="font-display text-2xl text-navy">Customer texts</h1>
      <p className="mt-1 text-sm text-muted">
        SMS only after a job is yours. Available tickets hide the customer phone. Twilio skips reserved 555
        numbers; if Twilio is not configured the note still saves.
      </p>

      {jobs.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-muted">
          Accept or get assigned a job to text the customer.
        </p>
      ) : null}

      <JobSmsList title="Open jobs" jobs={open} />
      <JobSmsList title="Closed jobs" jobs={closed} />
    </ContractorAppShell>
  );
}

function JobSmsList({ title, jobs }: { title: string; jobs: SmsJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {jobs.map((job) => (
        <article key={job.id} className="rounded-2xl border border-line bg-paper p-4">
          <Link href={`/contractor/jobs/${job.id}`} className="block">
            <p className="font-mono text-xs text-muted">{job.publicId}</p>
            <p className="font-display text-xl text-navy">{getTrade(job.trade)?.name ?? job.trade}</p>
            <p className="text-sm text-navy">
              {job.customerName} · {formatPhone(job.customerPhone)}
            </p>
            <p className="text-xs text-muted">{statusLabel(job.status)}</p>
          </Link>
          <div className="mt-3">
            <ContractorSmsForm id={job.id} smsStatus={job.customerSmsStatus} kind="message" />
          </div>
        </article>
      ))}
    </section>
  );
}
