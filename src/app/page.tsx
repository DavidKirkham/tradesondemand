import Link from "next/link";
import { CallButton } from "@/components/CallButton";
import { KC_METRO_CITIES } from "@/lib/kc-metro";
import { formatPhone, getDispatchPhone } from "@/lib/phone";
import { TRADES } from "@/lib/trades";

export default function HomePage() {
  const phone = formatPhone(getDispatchPhone());
  const featured = TRADES.slice(0, 8);

  return (
    <>
      <section className="hero-grid text-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
          <div>
            <p className="stamp text-xs text-gold">Kansas City metro only · MO &amp; KS</p>
            <h1 className="mt-4 font-display text-4xl leading-tight md:text-6xl">
              Any trade. On demand. In KC.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-7 text-cream/80">
              Burst pipe in Brookside, no heat in Overland Park, lockout in Lee&apos;s Summit, or a
              Saturday handyman list — one booking desk for every trade, emergency or routine.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex h-14 items-center justify-center rounded-full bg-ember px-6 text-base font-semibold text-white shadow-[0_8px_24px_rgba(226,91,26,0.28)]"
              >
                Book a job
              </Link>
              <CallButton variant="cream" size="lg" />
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-cream/70 sm:grid-cols-2">
              <li>18 trades, including Other</li>
              <li>Tap-to-call dispatch {phone}</li>
              <li>Metro ZIP gate — we don&apos;t fake statewide coverage</li>
              <li>Job status link after you book</li>
            </ul>
          </div>
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="stamp text-xs text-gold">If it&apos;s bad, start here</p>
            <h2 className="mt-2 font-display text-2xl">Emergency path</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-cream/80">
              <li>
                <strong className="text-cream">1. Danger?</strong> Gas, fire, flooding into power —
                call 911, then us.
              </li>
              <li>
                <strong className="text-cream">2. Call or book.</strong> Tap {phone} or send the
                60-second form.
              </li>
              <li>
                <strong className="text-cream">3. Stay reachable.</strong> We assign a local partner
                and update the ticket.
              </li>
            </ol>
            <Link
              href="/book?urgency=emergency"
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-cream text-sm font-semibold text-navy"
            >
              Start an emergency booking
            </Link>
          </aside>
        </div>
      </section>

      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted">
          <span className="stamp mr-3 text-[0.65rem] text-navy">We dispatch to</span>
          {KC_METRO_CITIES.join(" · ")}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="stamp text-xs text-ember">Not just plumbing</p>
            <h2 className="mt-2 font-display text-3xl text-navy md:text-4xl">Every trade we book</h2>
          </div>
          <Link href="/services" className="hidden text-sm font-semibold text-ember sm:inline">
            See all services
          </Link>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((trade) => (
            <Link
              key={trade.slug}
              href={`/book?trade=${trade.slug}`}
              className="rounded-2xl border border-line bg-paper p-5 hover:border-navy/30"
            >
              <h3 className="font-display text-xl text-navy">{trade.name}</h3>
              <p className="mt-2 text-sm text-muted">{trade.short}</p>
            </Link>
          ))}
        </div>
        <Link href="/services" className="mt-6 inline-block text-sm font-semibold text-ember sm:hidden">
          See all services
        </Link>
      </section>

      <section className="bg-navy text-cream">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="stamp text-xs text-gold">How booking works</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Five steps. Then a human.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-5 lg:grid-cols-5">
            {[
              ["Trade + problem", "Pick any trade and say what failed."],
              ["KC address", "ZIP and city have to sit in the metro."],
              ["Emergency or routine", "We route the ticket, not a national call center."],
              ["Pick a licensed pro", "Choose an approved contractor or first available."],
              ["Quote + confirm", "Rates, deposit rules, then a live ticket."],
            ].map(([title, copy], index) => (
              <div key={title} className="rounded-2xl bg-white/5 p-4">
                <p className="font-mono text-gold">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 font-display text-lg">{title}</h3>
                <p className="mt-2 text-sm text-cream/70">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="font-display text-2xl text-navy">Why we stay in the metro</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              A Wichita or St. Louis ZIP is someone else&apos;s job. Trades on Demand is a new KC
              company that only books work a local crew can reach — Kansas City, Overland Park,
              Olathe, Independence, Lee&apos;s Summit, Shawnee, and the towns in between.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="font-display text-2xl text-navy">Licensed contractors</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              If you hold a MO or KS license and cover the KC metro, apply to join the bench. Ops
              reviews insurance and license before you appear in the directory or booking picker.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/contractors" className="text-sm font-semibold text-ember">
                Browse approved partners
              </Link>
              <Link href="/contractors/signup" className="text-sm font-semibold text-navy">
                Apply to join
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="font-display text-2xl text-navy">Price, before anyone drives</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Emergencies show a dispatch hold range. Routine visits don&apos;t take a trip fee to
              get on the calendar. You pay Trades on Demand; payments are processed by Trademark
              Walls. We pay the partner. If Stripe keys are missing, the job still books and the
              deposit stays pending.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-ember px-6 py-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl">Need a tech in KC tonight?</h2>
            <p className="mt-2 text-white/85">Book online or call dispatch. We&apos;ll tell you if we can&apos;t cover the ZIP.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
            >
              Start booking
            </Link>
            <CallButton variant="cream" />
          </div>
        </div>
      </section>
    </>
  );
}
