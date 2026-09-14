import type { Metadata } from "next";
import Link from "next/link";
import { ContractorCard } from "@/components/contractors/ContractorCard";
import { toPublicContractor } from "@/lib/contractor";
import { prisma } from "@/lib/prisma";
import { TRADES } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Kansas City contractors",
  description: "Approved, licensed tradespeople in the Kansas City metro.",
};

export const dynamic = "force-dynamic";

export default async function ContractorsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string }>;
}) {
  const { trade } = await searchParams;
  const rows = await prisma.contractor.findMany({
    where: { status: "APPROVED" },
    orderBy: { businessName: "asc" },
  });
  const contractors = rows
    .map(toPublicContractor)
    .filter((row) => !trade || row.trades.includes(trade));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="stamp text-xs text-ember">Directory</p>
          <h1 className="mt-2 font-display text-4xl text-navy">Licensed KC partners</h1>
          <p className="mt-3 max-w-xl text-muted">
            Only ops-approved contractors appear here. Pending applications stay on the internal
            board.
          </p>
        </div>
        <Link
          href="/contractors/signup"
          className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
        >
          Apply as a contractor
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/contractors"
          className={`rounded-full px-3 py-1.5 text-sm ${!trade ? "bg-navy text-cream" : "border border-line"}`}
        >
          All trades
        </Link>
        {TRADES.map((item) => (
          <Link
            key={item.slug}
            href={`/contractors?trade=${item.slug}`}
            className={`rounded-full px-3 py-1.5 text-sm ${
              trade === item.slug ? "bg-navy text-cream" : "border border-line"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {contractors.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          No approved {trade ? "pros for that trade" : "contractors"} yet. Licensed shops can{" "}
          <Link href="/contractors/signup" className="font-semibold text-ember">
            apply here
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
          {contractors.map((contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}
