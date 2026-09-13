import Link from "next/link";
import { rateForTrade, type PublicContractor } from "@/lib/contractor";
import { formatUsd } from "@/lib/money";
import { getTrade } from "@/lib/trades";
import { ContractorAvatar } from "./ContractorAvatar";

export function ContractorCard({
  contractor,
  trade,
}: {
  contractor: PublicContractor;
  trade?: string;
}) {
  const rate = trade ? rateForTrade(contractor, trade) : { hourlyCents: contractor.hourlyRateCents, minimumCents: contractor.minimumChargeCents };
  const names = contractor.trades.map((slug) => getTrade(slug)?.name ?? slug).join(" · ");

  return (
    <article className="flex gap-4 rounded-2xl border border-line bg-paper p-5">
      <ContractorAvatar name={contractor.businessName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl text-navy">{contractor.businessName}</h3>
          {contractor.status === "APPROVED" ? (
            <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[0.7rem] font-semibold text-ok">
              Licensed · approved
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">{names}</p>
        <p className="mt-2 text-sm text-navy">
          {formatUsd(rate.hourlyCents)}/hr · {formatUsd(rate.minimumCents)} min
          {contractor.emergencyRateCents ? ` · after-hours ${formatUsd(contractor.emergencyRateCents)}` : ""}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{contractor.serviceArea}</p>
        <Link href={`/contractors/${contractor.slug}`} className="mt-3 inline-block text-sm font-semibold text-ember">
          View profile
        </Link>
      </div>
    </article>
  );
}
