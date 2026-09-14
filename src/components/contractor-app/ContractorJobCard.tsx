import Link from "next/link";
import { statusLabel } from "@/lib/booking";
import { formatPhone } from "@/lib/phone";
import { getTrade } from "@/lib/trades";

export function ContractorJobCard({
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
  extra,
}: {
  id: string;
  publicId: string;
  trade: string;
  urgency: string;
  city: string;
  zip: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  revealCustomer: boolean;
  problem?: string;
  extra?: string;
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
            {customerName}
            {customerPhone ? ` · ${formatPhone(customerPhone)}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-navy">
            {problem
              ? problem.length > 140
                ? `${problem.slice(0, 137)}…`
                : problem
              : "Neighborhood / ZIP only until you accept."}
          </p>
        )}
        {extra ? <p className="mt-1 text-xs font-semibold text-muted">{extra}</p> : null}
      </Link>
    </li>
  );
}
