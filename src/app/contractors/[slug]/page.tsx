import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorAvatar } from "@/components/contractors/ContractorAvatar";
import { rateForTrade, toPublicContractor } from "@/lib/contractor";
import { formatUsd } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await prisma.contractor.findUnique({ where: { slug } });
  if (!row || row.status !== "APPROVED") {
    return { title: "Contractor" };
  }
  return { title: row.businessName, description: `${row.businessName} — licensed KC metro partner` };
}

export default async function ContractorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await prisma.contractor.findUnique({ where: { slug } });
  if (!row || row.status !== "APPROVED") notFound();

  const contractor = toPublicContractor(row);
  const primaryTrade = contractor.trades[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex gap-4">
        <ContractorAvatar name={contractor.businessName} size="lg" />
        <div>
          <p className="stamp text-xs text-ok">Licensed · KC metro</p>
          <h1 className="mt-1 font-display text-4xl text-navy">{contractor.businessName}</h1>
          <p className="mt-2 text-sm text-muted">
            {contractor.licenseType} · {contractor.licenseState} · #{contractor.licenseNumber}
            {contractor.yearsExperience != null ? ` · ${contractor.yearsExperience} years` : ""}
          </p>
        </div>
      </div>

      {contractor.bio ? <p className="mt-6 text-base leading-7 text-muted">{contractor.bio}</p> : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <p className="stamp text-xs text-muted">Trades</p>
          <ul className="mt-2 space-y-1 text-sm text-navy">
            {contractor.trades.map((slugName) => (
              <li key={slugName}>{getTrade(slugName)?.name ?? slugName}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5">
          <p className="stamp text-xs text-muted">Service area</p>
          <p className="mt-2 text-sm leading-6 text-navy">{contractor.serviceArea}</p>
          {contractor.insured ? (
            <p className="mt-3 text-xs text-ok">Liability insurance confirmed on application</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-navy p-6 text-cream">
        <p className="stamp text-xs text-gold">Rates</p>
        <p className="mt-2 text-3xl font-semibold text-gold">
          {formatUsd(contractor.hourlyRateCents)}/hr
        </p>
        <p className="mt-1 text-sm text-cream/80">
          {formatUsd(contractor.minimumChargeCents)} minimum / trip fee
          {contractor.emergencyRateCents
            ? ` · after-hours ${formatUsd(contractor.emergencyRateCents)}`
            : ""}
        </p>
        <ul className="mt-4 space-y-1 text-sm text-cream/80">
          {contractor.tradeRates.map((row) => {
            const rate = rateForTrade(contractor, row.slug);
            return (
              <li key={row.slug}>
                {getTrade(row.slug)?.name ?? row.slug}: {formatUsd(rate.hourlyCents)}/hr ·{" "}
                {formatUsd(rate.minimumCents)} min
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={primaryTrade ? `/book?trade=${primaryTrade}&contractor=${contractor.slug}` : "/book"}
          className="inline-flex h-12 items-center justify-center rounded-full bg-ember px-5 text-sm font-semibold text-white"
        >
          Book this contractor
        </Link>
        <Link href="/contractors" className="inline-flex h-12 items-center justify-center text-sm font-semibold text-navy">
          All approved partners
        </Link>
      </div>
    </div>
  );
}
