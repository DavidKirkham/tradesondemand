import { ContractorAppShell } from "@/components/contractor-app/ContractorAppShell";
import { ContractorLogin } from "@/components/contractor-app/ContractorLogin";
import { ContractorProfileForm } from "@/components/contractor-app/ContractorProfileForm";
import { parseContractorTradeRates, parseContractorTrades } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function ContractorProfilePage() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) return <ContractorLogin />;

  const trades = parseContractorTrades(contractor.tradesJson);

  return (
    <ContractorAppShell businessName={contractor.businessName}>
      <h1 className="font-display text-2xl text-navy">Public profile</h1>
      <p className="mt-1 text-sm text-muted">
        These fields appear on /contractors. License and approval stay with dispatch.
      </p>
      <p className="mt-2 text-sm text-navy">
        {trades.map((slug) => getTrade(slug)?.name ?? slug).join(" · ")} · {contractor.licenseState} #
        {contractor.licenseNumber}
      </p>
      <div className="mt-5">
        <ContractorProfileForm
          bio={contractor.bio}
          serviceArea={contractor.serviceArea}
          hourlyRateCents={contractor.hourlyRateCents}
          minimumChargeCents={contractor.minimumChargeCents}
          emergencyRateCents={contractor.emergencyRateCents}
          yearsExperience={contractor.yearsExperience}
          trades={trades}
          tradeRates={parseContractorTradeRates(contractor.tradeRatesJson)}
          slug={contractor.slug}
        />
      </div>
    </ContractorAppShell>
  );
}
