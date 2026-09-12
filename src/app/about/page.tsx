import type { Metadata } from "next";
import Link from "next/link";
import { CallButton } from "@/components/CallButton";

export const metadata: Metadata = {
  title: "About",
  description:
    "Trades on Demand is a new Kansas City company booking any trade — emergency or routine — inside the metro only.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="stamp text-xs text-ember">About</p>
      <h1 className="mt-2 font-display text-4xl text-navy">A KC dispatch desk, not a national lead mill</h1>
      <div className="mt-6 space-y-5 text-base leading-7 text-muted">
        <p>
          Trades on Demand is a new company built for one metro: Kansas City. We book any trade
          service — plumbing and electrical, yes, but also roofing after hail, garage doors,
          locksmiths, pest, restoration, fencing, and the jobs that don&apos;t fit a tidy category.
        </p>
        <p>
          We stay inside the KCMO / Johnson County / Independence / Lee&apos;s Summit belt because
          that is how you keep arrival times honest. If your ZIP is Wichita, Columbia, or Topeka,
          we will say no in the form instead of taking a deposit and hoping.
        </p>
        <p>
          v1 is the customer booking loop plus a lightweight ops board. There is no contractor
          mobile app yet, and payments/SMS are stubbed. The product you see is the desk a
          homeowner or property manager would actually use at 11 p.m. when the water heater goes.
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/book"
          className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
        >
          Book a trade
        </Link>
        <CallButton variant="ghost" />
      </div>
    </div>
  );
}
