import Link from "next/link";
import { statusLabel } from "@/lib/booking";
import { customerPaymentTotals } from "@/lib/customer-jobs";
import { formatUsd } from "@/lib/money";
import { getTrade } from "@/lib/trades";

export function AccountJobCard({
  publicId,
  trade,
  status,
  createdAt,
  city,
  state,
  zip,
  contractorName,
  payments,
}: {
  publicId: string;
  trade: string;
  status: string;
  createdAt: Date;
  city: string;
  state: string;
  zip: string;
  contractorName?: string | null;
  payments: { amountCents: number; status: string }[];
}) {
  const totals = customerPaymentTotals(payments);
  const when = createdAt.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article>
      <Link
        href={`/account/jobs/${encodeURIComponent(publicId)}`}
        className="block rounded-2xl border border-line bg-paper p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-mono text-xs text-muted">{publicId}</p>
          <p className="text-xs text-muted">{when}</p>
        </div>
        <p className="mt-1 font-display text-xl text-navy">{getTrade(trade)?.name ?? trade}</p>
        <p className="text-sm text-muted">
          {statusLabel(status)}
          {contractorName ? ` · ${contractorName}` : " · first available"}
          {` · ${city}, ${state} ${zip}`}
        </p>
        {totals.pendingCents > 0 ? (
          <p className="mt-2 text-sm font-semibold text-ember">
            Owed to TOD {formatUsd(totals.pendingCents)}
          </p>
        ) : totals.paidCents > 0 ? (
          <p className="mt-2 text-sm text-ok">Paid to TOD {formatUsd(totals.paidCents)}</p>
        ) : null}
      </Link>
    </article>
  );
}
