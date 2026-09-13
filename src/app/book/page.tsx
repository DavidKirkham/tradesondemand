import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { findApprovedContractor } from "@/lib/contractor-lookup";
import { isKnownTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Book a trade",
  description: "Guided booking for any trade in the Kansas City metro.",
};

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string; urgency?: string; contractor?: string }>;
}) {
  const params = await searchParams;
  const initialTrade = params.trade && isKnownTrade(params.trade) ? params.trade : "";
  const initialUrgency = params.urgency === "emergency" || params.urgency === "routine" ? params.urgency : "";

  let initialContractorId = "";
  if (params.contractor) {
    const contractor = await findApprovedContractor(params.contractor);
    if (contractor) initialContractorId = contractor.id;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BookingWizard
        initialTrade={initialTrade}
        initialUrgency={initialUrgency}
        initialContractorId={initialContractorId}
      />
    </div>
  );
}
