import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { isKnownTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Book a trade",
  description: "Guided booking for any trade in the Kansas City metro.",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string; urgency?: string }>;
}) {
  const params = await searchParams;
  const initialTrade = params.trade && isKnownTrade(params.trade) ? params.trade : "";
  const initialUrgency = params.urgency === "emergency" || params.urgency === "routine" ? params.urgency : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BookingWizard initialTrade={initialTrade} initialUrgency={initialUrgency} />
    </div>
  );
}
