import type { Metadata } from "next";
import Link from "next/link";
import { CallButton } from "@/components/CallButton";
import { formatPhone, getDispatchPhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Contact",
  description: "Call or book Trades on Demand for any trade in the Kansas City metro.",
};

export default function ContactPage() {
  const phone = formatPhone(getDispatchPhone());

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="stamp text-xs text-ember">Contact</p>
      <h1 className="mt-2 font-display text-4xl text-navy">Talk to dispatch</h1>
      <p className="mt-4 text-muted">
        The fastest path is a phone call. Online booking is the same desk — it just gives you a
        status link.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-6">
          <p className="stamp text-xs text-muted">Phone</p>
          <p className="mt-2 font-display text-2xl text-navy">{phone}</p>
          <p className="mt-2 text-sm text-muted">Kansas City dispatch.</p>
          <div className="mt-4">
            <CallButton />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6">
          <p className="stamp text-xs text-muted">Book online</p>
          <p className="mt-2 font-display text-2xl text-navy">Same ticket</p>
          <p className="mt-2 text-sm text-muted">Trade, address, urgency, confirm. KC metro only.</p>
          <Link
            href="/book"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-navy px-4 text-sm font-semibold text-cream"
          >
            Start a booking
          </Link>
        </div>
      </div>
      <p className="mt-8 text-sm text-muted">
        Service area is the Kansas City metro only. If the form rejects your ZIP, we mean it —
        call only if you think we misread a local city.
      </p>
    </div>
  );
}
