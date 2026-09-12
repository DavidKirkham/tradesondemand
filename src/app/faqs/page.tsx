import type { Metadata } from "next";
import { CallButton } from "@/components/CallButton";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Kansas City service area, trades, emergency dispatch, and booking questions.",
};

const FAQS = [
  {
    q: "Do you only work in Kansas City?",
    a: "Yes. Missouri and Kansas sides of the KC metro — Kansas City, Overland Park, Olathe, Independence, Lee's Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby ZIPs. We do not book Springfield, Wichita, Columbia, or anywhere else.",
  },
  {
    q: "Is this just plumbing and electrical?",
    a: "No. v1 covers 17 named trades plus General contractor / Other: HVAC, roofing, handyman, painting, flooring, appliances, locksmith, pest, landscaping, cleaning, garage doors, concrete, fencing, windows & doors, and water damage.",
  },
  {
    q: "What counts as an emergency?",
    a: "Something that is actively getting worse or leaving a home unsafe: no heat in a freeze, standing water, lockout, garage door stuck open, sparking electrical. If it is life-threatening, call 911 first.",
  },
  {
    q: "Will you take a payment online?",
    a: "Not in this version. You will see the dispatch-hold and deposit rules before you confirm. Card charges and SMS are out of scope for v1.",
  },
  {
    q: "I rent in Midtown / a Johnson County apartment. Can I book?",
    a: "Yes, if the job ZIP is in the metro. We still need a name and a phone the tech can use at the door. Landlord approval is on you.",
  },
  {
    q: "How do I check status?",
    a: "After booking you get a public job ID (TOD-XXXXXX) and a private status link. Either works on the Track a job page.",
  },
  {
    q: "Do you have a contractor app?",
    a: "Not yet. Partners are coordinated from the lightweight ops board. Homeowners book on the website / PWA.",
  },
  {
    q: "Why was my ZIP rejected?",
    a: "The form checks city and ZIP against the KC metro list. A Kansas City city name with a Denver ZIP (or the reverse) is declined with a clear message.",
  },
];

export default function FaqsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="stamp text-xs text-ember">FAQs</p>
      <h1 className="mt-2 font-display text-4xl text-navy">Straight answers for KC jobs</h1>
      <div className="mt-8 space-y-4">
        {FAQS.map((item) => (
          <details key={item.q} className="rounded-2xl border border-line bg-paper px-5 py-4">
            <summary className="cursor-pointer font-medium text-navy">{item.q}</summary>
            <p className="mt-3 text-sm leading-6 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8">
        <CallButton />
      </div>
    </div>
  );
}
