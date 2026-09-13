import { parseTradesJson, parseTradeRatesJson, serviceAreaLooksLikeMetro, type TradeRate } from "./contractor";
import { isMetroCity, isMetroZip } from "./kc-metro";
import { parseUsdToCents } from "./money";
import { isKnownTrade } from "./trades";

export const CONTRACTOR_JOB_STATUSES = ["DISPATCHED", "EN_ROUTE", "ON_SITE", "COMPLETED"] as const;
export type ContractorJobStatus = (typeof CONTRACTOR_JOB_STATUSES)[number];

export function contractorLoginBlockReason(status: string): string | null {
  if (status === "APPROVED") return null;
  if (status === "PENDING") return "Your application is still pending review.";
  if (status === "REJECTED") return "This application was not approved.";
  return "No approved contractor matches that email and phone.";
}

export function isContractorJobStatus(value: string): value is ContractorJobStatus {
  return (CONTRACTOR_JOB_STATUSES as readonly string[]).includes(value);
}

export function contractorStatusActionLabel(status: string): string {
  switch (status) {
    case "DISPATCHED":
      return "Accepted";
    case "EN_ROUTE":
      return "En route";
    case "ON_SITE":
      return "On site";
    case "COMPLETED":
      return "Done";
    default:
      return status;
  }
}

export function jobFitsContractor(
  booking: { trade: string; city: string; zip: string },
  contractor: { tradesJson: string; serviceArea: string },
): boolean {
  const trades = parseTradesJson(contractor.tradesJson);
  if (!trades.includes(booking.trade)) return false;
  const area = contractor.serviceArea.toLowerCase();
  const city = booking.city.trim().toLowerCase();
  if (city && area.includes(city)) return true;
  if (booking.zip && area.includes(booking.zip)) return true;
  // "KC metro" / "Kansas City metro" covers any metro city/ZIP; a city-only list does not.
  if (/\bmetro\b/i.test(contractor.serviceArea) && (isMetroCity(booking.city) || isMetroZip(booking.zip))) {
    return true;
  }
  return false;
}

export type ContractorProfilePatch = {
  bio?: string;
  serviceArea?: string;
  hourlyRate?: string;
  minimumCharge?: string;
  emergencyRate?: string;
  yearsExperience?: string;
  tradeRates?: { slug: string; hourly: string; minimum: string }[];
};

export type ContractorProfileValidated = {
  bio: string | null;
  serviceArea: string;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  yearsExperience: number | null;
  tradeRates: TradeRate[];
};

export function validateContractorProfilePatch(
  input: ContractorProfilePatch,
  currentTrades: string[],
): { ok: true; data: ContractorProfileValidated } | { ok: false; message: string } {
  const bio = input.bio?.trim() || null;
  if (bio && bio.length > 800) return { ok: false, message: "Keep the bio under 800 characters." };

  const serviceArea = (input.serviceArea ?? "").trim();
  if (!serviceAreaLooksLikeMetro(serviceArea)) {
    return { ok: false, message: "Describe KC metro coverage — cities or 5-digit metro ZIPs." };
  }

  const hourlyRateCents = parseUsdToCents(input.hourlyRate ?? "");
  if (!hourlyRateCents) return { ok: false, message: "Enter a primary hourly rate." };

  const minimumChargeCents = parseUsdToCents(input.minimumCharge ?? "");
  if (!minimumChargeCents) return { ok: false, message: "Enter a trip / service-call minimum." };

  let emergencyRateCents: number | null = null;
  if (input.emergencyRate?.trim()) {
    emergencyRateCents = parseUsdToCents(input.emergencyRate);
    if (!emergencyRateCents) return { ok: false, message: "After-hours rate must be a positive dollar amount." };
  }

  let yearsExperience: number | null = null;
  if (input.yearsExperience?.trim()) {
    const years = Number(input.yearsExperience);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      return { ok: false, message: "Years of experience should be 0–60." };
    }
    yearsExperience = years;
  }

  const tradeRates: TradeRate[] = [];
  for (const slug of currentTrades.filter(isKnownTrade)) {
    const override = input.tradeRates?.find((row) => row.slug === slug);
    const hourly = override?.hourly.trim() ? parseUsdToCents(override.hourly) : hourlyRateCents;
    const minimum = override?.minimum.trim() ? parseUsdToCents(override.minimum) : minimumChargeCents;
    if (!hourly || !minimum) {
      return { ok: false, message: `Enter a positive hourly rate and minimum for ${slug}.` };
    }
    tradeRates.push({ slug, hourlyCents: hourly, minimumCents: minimum });
  }

  return {
    ok: true,
    data: {
      bio,
      serviceArea,
      hourlyRateCents,
      minimumChargeCents,
      emergencyRateCents,
      yearsExperience,
      tradeRates,
    },
  };
}

export function parseContractorTrades(tradesJson: string) {
  return parseTradesJson(tradesJson);
}

export function parseContractorTradeRates(tradeRatesJson: string) {
  return parseTradeRatesJson(tradeRatesJson);
}
