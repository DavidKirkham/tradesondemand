import Link from "next/link";
import { KC_METRO_CITIES } from "@/lib/kc-metro";
import { formatPhone, getDispatchPhone } from "@/lib/phone";
import { BrandMark } from "./BrandMark";
import { CallButton } from "./CallButton";

export function SiteFooter() {
  const phone = formatPhone(getDispatchPhone());

  return (
    <footer className="mt-auto border-t border-navy/10 bg-navy text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandMark light />
          <p className="mt-4 max-w-md text-sm leading-6 text-cream/75">
            Any trade service in the Kansas City metro — emergency or routine. We stay on this side
            of the state line corridor on purpose so a local partner can actually get to you.
          </p>
          <div className="mt-5">
            <CallButton variant="cream" />
          </div>
        </div>
        <div>
          <p className="stamp text-xs text-gold">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li>
              <Link href="/services">All trades</Link>
            </li>
            <li>
              <Link href="/book">Book online</Link>
            </li>
            <li>
              <Link href="/contractors">Find a contractor</Link>
            </li>
            <li>
              <Link href="/contractors/signup">Join as a licensed contractor</Link>
            </li>
            <li>
              <Link href="/contractor">Contractor app</Link>
            </li>
            <li>
              <Link href="/status">Job status</Link>
            </li>
            <li>
              <Link href="/account">My profile / jobs</Link>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/faqs">FAQs</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
            <li>
              <Link href="/admin">Admin</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="stamp text-xs text-gold">Dispatch</p>
          <p className="mt-3 text-sm text-cream/80">{phone}</p>
          <p className="mt-2 text-sm text-cream/80">Kansas City metro only · MO &amp; KS</p>
          <p className="mt-2 text-sm text-cream/65">If it is life-threatening, call 911 first.</p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-6">
        <div className="mx-auto max-w-6xl text-xs leading-6 text-cream/55">
          Service area: {KC_METRO_CITIES.join(" · ")} and nearby KC ZIP codes. You pay Trades on
          Demand; v1 stubs the card charge. No SMS.
        </div>
      </div>
    </footer>
  );
}
