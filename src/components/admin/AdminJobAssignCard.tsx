import Link from "next/link";
import { AdminAssignContractor } from "./AdminAssignContractor";
import type { AdminContractorOption } from "@/lib/admin-assign";
import { statusLabel } from "@/lib/booking";
import { getTrade } from "@/lib/trades";

export function AdminJobAssignCard({
  id,
  publicId,
  trade,
  city,
  state,
  zip,
  status,
  urgency,
  customerName,
  contractorId,
  contractorName,
  contractors,
}: {
  id: string;
  publicId: string;
  trade: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  urgency: string;
  customerName: string;
  contractorId: string | null;
  contractorName: string | null;
  contractors: AdminContractorOption[];
}) {
  return (
    <article className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/admin/jobs/${id}`} className="font-mono text-xs font-semibold text-ember hover:underline">
            {publicId}
          </Link>
          <p className="font-display text-xl text-navy">{getTrade(trade)?.name ?? trade}</p>
          <p className="text-sm text-muted">
            {customerName} · {city}, {state} {zip} · {urgency} · {statusLabel(status)}
          </p>
          <p className="mt-1 text-sm text-navy">
            {contractorName ? `Current shop: ${contractorName}` : "Unassigned — pick a shop below"}
          </p>
        </div>
        <Link href={`/admin/jobs/${id}`} className="text-sm font-semibold text-ember">
          Job detail
        </Link>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <AdminAssignContractor
          bookingId={id}
          trade={trade}
          currentContractorId={contractorId}
          currentContractorName={contractorName}
          contractors={contractors}
        />
      </div>
    </article>
  );
}
