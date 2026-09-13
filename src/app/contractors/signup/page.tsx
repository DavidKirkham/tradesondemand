import type { Metadata } from "next";
import { ContractorSignupForm } from "@/components/contractors/ContractorSignupForm";
import { CallButton } from "@/components/CallButton";

export const metadata: Metadata = {
  title: "Licensed contractor signup",
  description:
    "Apply to join Trades on Demand as a licensed Kansas City metro contractor. Ops reviews license and insurance before you appear publicly.",
};

export default function ContractorSignupPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="stamp text-xs text-ember">For licensed KC contractors</p>
      <h1 className="mt-2 font-display text-4xl text-navy">Join the metro bench</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Trades on Demand is a Kansas City dispatch desk, not a national lead mill. Apply if you are
        licensed in Missouri or Kansas and actually cover this metro. There is no contractor app in
        v1 — signup and ops review only. Approved shops get a public profile customers can open
        before they book. Customers pay Trades on Demand; we pay you. Do not add a personal checkout.
      </p>
      <div className="mt-5">
        <CallButton variant="ghost" />
      </div>
      <div className="mt-8">
        <ContractorSignupForm />
      </div>
    </div>
  );
}
