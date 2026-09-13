import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorJobCard } from "@/components/contractor-app/ContractorJobCard";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { isPastContractorJob } from "@/lib/contractor-app";
import { requireApprovedContractor } from "@/lib/contractor-auth";
import { invoiceStatusLabel } from "@/lib/invoice";
import { isMissingInvoiceModel } from "@/lib/invoice-columns";
import { formatUsd } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContractorPastJobsPage() {
  const contractor = await requireApprovedContractor("/contractor/past");

  const rows = await prisma.booking.findMany({
    where: { contractorId: contractor.id },
    orderBy: { updatedAt: "desc" },
    omit: BOOKING_SMS_OMIT,
  });
  const past = rows.filter((job) => isPastContractorJob(job.status));
  let invoiceByBooking = new Map<string, { status: string; amountDueCents: number }>();
  try {
    const invoices = await prisma.invoice.findMany({
      where: { contractorId: contractor.id, bookingId: { in: past.map((job) => job.id) } },
      select: { bookingId: true, status: true, amountDueCents: true },
    });
    invoiceByBooking = new Map(invoices.map((row) => [row.bookingId, row]));
  } catch (error) {
    if (!isMissingInvoiceModel(error)) throw error;
  }

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
            <ContractorJobCard
              key={job.id}
              {...job}
              revealCustomer
              problem={job.problem}
              extra={invoiceExtra(job.status, invoiceByBooking.get(job.id))}
            />
          ))}
        </ul>
      )}
    </ContractorAppShell>
  );
}

function invoiceExtra(
  status: string,
  invoice?: { status: string; amountDueCents: number },
): string | undefined {
  if (status === "CANCELLED") return undefined;
  if (!invoice) return "Send a time & materials invoice so the customer can pay TOD.";
  if (invoice.status === "DRAFT") return "Invoice draft — send it to the customer.";
  if (invoice.status === "SENT" && invoice.amountDueCents > 0) {
    return `${invoiceStatusLabel(invoice.status)} · TOD balance ${formatUsd(invoice.amountDueCents)}`;
  }
  return invoiceStatusLabel(invoice.status);
}
