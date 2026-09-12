import type { Metadata } from "next";
import Link from "next/link";
import { CallButton } from "@/components/CallButton";
import { TRADES } from "@/lib/trades";

export const metadata: Metadata = {
  title: "All trades in Kansas City",
  description:
    "Book plumbing, electrical, HVAC, roofing, locksmith, restoration, and more — Kansas City metro only.",
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="stamp text-xs text-ember">Service menu</p>
      <h1 className="mt-2 font-display text-4xl text-navy">Every trade we dispatch</h1>
      <p className="mt-4 max-w-2xl text-muted">
        One product, not a plumbing-only shop. If it isn&apos;t listed, choose General contractor /
        Other and tell us what broke.
      </p>
      <div className="mt-6">
        <CallButton />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {TRADES.map((trade) => (
          <article key={trade.slug} className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="font-display text-2xl text-navy">{trade.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{trade.description}</p>
            <p className="mt-3 text-xs text-muted">
              Emergency: {trade.emergencyExamples.join(" · ")}
            </p>
            <Link
              href={`/book?trade=${trade.slug}`}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-navy px-4 text-sm font-semibold text-cream"
            >
              Book {trade.name}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
