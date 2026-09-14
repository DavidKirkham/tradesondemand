import { randomBytes } from "node:crypto";
import { isMetroCity, isMetroZip, KC_METRO_CITIES, normalizeCity, normalizeState } from "./kc-metro";
import { parseUsdToCents } from "./money";
import { isValidEmail, isValidUsPhone } from "./phone";
import { isKnownTrade, TRADES } from "./trades";

export const CONTRACTOR_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ContractorStatus = (typeof CONTRACTOR_STATUSES)[number];

export type TradeRateInput = {
  slug: string;
  hourly: string;
  minimum: string;
};

export type ContractorInput = {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  trades: string[];
  licenseNumber: string;
  licenseType: string;
  licenseState: string;
  serviceArea: string;
  insured: boolean;
  insuranceDetails?: string;
  yearsExperience?: string;
  bio?: string;
  hourlyRate: string;
  minimumCharge: string;
  emergencyRate?: string;
  tradeRates?: TradeRateInput[];
  agreedToTerms: boolean;
};

export type TradeRate = {
  slug: string;
  hourlyCents: number;
  minimumCents: number;
};

export type ValidatedContractor = {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  trades: string[];
  licenseNumber: string;
  licenseType: string;
  licenseState: "MO" | "KS";
  serviceArea: string;
  insured: true;
  insuranceDetails: string | null;
  yearsExperience: number | null;
  bio: string | null;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  tradeRates: TradeRate[];
};

export type ContractorValidation =
  | { ok: true; data: ValidatedContractor }
  | { ok: false; message: string; field?: string };

export function createContractorPublicId(): string {
  return `PRO-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function createContractorLoginToken(): string {
  return randomBytes(18).toString("base64url");
}

export function createContractorSlug(businessName: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "contractor";
  return `${base}-${randomBytes(2).toString("hex")}`;
}

export function isContractorStatus(value: string): value is ContractorStatus {
  return (CONTRACTOR_STATUSES as readonly string[]).includes(value);
}

export function parseTradesJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && isKnownTrade(item));
  } catch {
    return [];
  }
}

export function parseTradeRatesJson(value: string): TradeRate[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TradeRate => {
      if (!item || typeof item !== "object") return false;
      const row = item as TradeRate;
      return isKnownTrade(row.slug) && row.hourlyCents > 0 && row.minimumCents > 0;
    });
  } catch {
    return [];
  }
}

export function serviceAreaLooksLikeMetro(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;
  if (KC_METRO_CITIES.some((city) => normalizeCity(raw).includes(normalizeCity(city)))) {
    return true;
  }
  if (isMetroCity(raw)) return true;
  const zips = raw.match(/\b\d{5}\b/g) ?? [];
  return zips.some((zip) => isMetroZip(zip));
}

export function rateForTrade(
  contractor: { hourlyRateCents: number; minimumChargeCents: number; tradeRates: TradeRate[] },
  trade: string,
): { hourlyCents: number; minimumCents: number } {
  const match = contractor.tradeRates.find((row) => row.slug === trade);
  return {
    hourlyCents: match?.hourlyCents ?? contractor.hourlyRateCents,
    minimumCents: match?.minimumCents ?? contractor.minimumChargeCents,
  };
}

export function contractorStatusLabel(status: string): string {
  switch (normalizeContractorStatus(status)) {
    case "PENDING":
      return "Pending review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

/** Approve / Reject only while the application is still in review. */
export function showContractorReviewActions(status: string): boolean {
  return normalizeContractorStatus(status) === "PENDING";
}

function normalizeContractorStatus(status: string): string {
  return status.trim().toUpperCase();
}

export function validateContractorInput(input: ContractorInput): ContractorValidation {
  const businessName = input.businessName.trim();
  if (businessName.length < 2) {
    return { ok: false, field: "businessName", message: "Enter the licensed business or contractor name." };
  }

  const contactName = input.contactName.trim();
  if (contactName.length < 2) {
    return { ok: false, field: "contactName", message: "Enter a contact name dispatch can reach." };
  }

  if (!isValidUsPhone(input.phone)) {
    return { ok: false, field: "phone", message: "Enter a 10-digit U.S. phone number." };
  }

  if (!isValidEmail(input.email)) {
    return { ok: false, field: "email", message: "Enter a working email for application updates." };
  }

  const trades = [...new Set(input.trades.filter(isKnownTrade))];
  if (trades.length === 0) {
    return { ok: false, field: "trades", message: "Select at least one trade you are licensed to perform." };
  }

  const licenseNumber = input.licenseNumber.trim();
  if (licenseNumber.length < 3) {
    return { ok: false, field: "licenseNumber", message: "Enter a license number we can verify." };
  }

  const licenseType = input.licenseType.trim();
  if (licenseType.length < 2) {
    return { ok: false, field: "licenseType", message: "What kind of license is it (e.g. Master plumber)?" };
  }

  const licenseState = normalizeState(input.licenseState);
  if (!licenseState) {
    return { ok: false, field: "licenseState", message: "License state must be Missouri or Kansas." };
  }

  const serviceArea = input.serviceArea.trim();
  if (!serviceAreaLooksLikeMetro(serviceArea)) {
    return {
      ok: false,
      field: "serviceArea",
      message:
        "Describe KC metro coverage — cities like Overland Park or Lee's Summit, or 5-digit metro ZIPs. We only accept licensed contractors who work this metro.",
    };
  }

  if (!input.insured) {
    return {
      ok: false,
      field: "insured",
      message: "Confirm you carry active liability insurance to apply.",
    };
  }

  let yearsExperience: number | null = null;
  if (input.yearsExperience?.trim()) {
    const years = Number(input.yearsExperience);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      return { ok: false, field: "yearsExperience", message: "Years of experience should be 0–60." };
    }
    yearsExperience = years;
  }

  const bio = input.bio?.trim() || null;
  if (bio && bio.length > 800) {
    return { ok: false, field: "bio", message: "Keep the bio under 800 characters." };
  }

  const hourlyRateCents = parseUsdToCents(input.hourlyRate);
  if (!hourlyRateCents) {
    return {
      ok: false,
      field: "hourlyRate",
      message: "Enter a primary hourly rate as a positive dollar amount (for example 95 or 95.00).",
    };
  }

  const minimumChargeCents = parseUsdToCents(input.minimumCharge);
  if (!minimumChargeCents) {
    return {
      ok: false,
      field: "minimumCharge",
      message: "Enter a minimum charge / trip fee as a positive dollar amount.",
    };
  }

  let emergencyRateCents: number | null = null;
  if (input.emergencyRate?.trim()) {
    emergencyRateCents = parseUsdToCents(input.emergencyRate);
    if (!emergencyRateCents) {
      return {
        ok: false,
        field: "emergencyRate",
        message: "Emergency / after-hours rate must be a positive dollar amount if you include one.",
      };
    }
  }

  const tradeRates: TradeRate[] = [];
  for (const trade of trades) {
    const override = input.tradeRates?.find((row) => row.slug === trade);
    const hourly = override?.hourly.trim()
      ? parseUsdToCents(override.hourly)
      : hourlyRateCents;
    const minimum = override?.minimum.trim()
      ? parseUsdToCents(override.minimum)
      : minimumChargeCents;
    if (!hourly || !minimum) {
      return {
        ok: false,
        field: "tradeRates",
        message: `Enter a positive hourly rate and minimum for ${TRADES.find((item) => item.slug === trade)?.name ?? trade}.`,
      };
    }
    tradeRates.push({ slug: trade, hourlyCents: hourly, minimumCents: minimum });
  }

  if (!input.agreedToTerms) {
    return {
      ok: false,
      field: "agreedToTerms",
      message: "Agree to the partner terms to submit an application.",
    };
  }

  return {
    ok: true,
    data: {
      businessName,
      contactName,
      phone: input.phone.replace(/\D/g, "").slice(-10),
      email: input.email.trim().toLowerCase(),
      trades,
      licenseNumber,
      licenseType,
      licenseState,
      serviceArea,
      insured: true,
      insuranceDetails: input.insuranceDetails?.trim() || null,
      yearsExperience,
      bio,
      hourlyRateCents,
      minimumChargeCents,
      emergencyRateCents,
      tradeRates,
    },
  };
}

export type PublicContractor = {
  id: string;
  slug: string;
  publicId: string;
  businessName: string;
  trades: string[];
  licenseType: string;
  licenseState: string;
  licenseNumber: string;
  serviceArea: string;
  yearsExperience: number | null;
  bio: string | null;
  insured: boolean;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  tradeRates: TradeRate[];
  status: ContractorStatus;
};

export function toPublicContractor(row: {
  id: string;
  slug: string;
  publicId: string;
  businessName: string;
  tradesJson: string;
  licenseType: string;
  licenseState: string;
  licenseNumber: string;
  serviceArea: string;
  yearsExperience: number | null;
  bio: string | null;
  insured: boolean;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  tradeRatesJson: string;
  status: string;
}): PublicContractor {
  return {
    id: row.id,
    slug: row.slug,
    publicId: row.publicId,
    businessName: row.businessName,
    trades: parseTradesJson(row.tradesJson),
    licenseType: row.licenseType,
    licenseState: row.licenseState,
    licenseNumber: row.licenseNumber,
    serviceArea: row.serviceArea,
    yearsExperience: row.yearsExperience,
    bio: row.bio,
    insured: row.insured,
    hourlyRateCents: row.hourlyRateCents,
    minimumChargeCents: row.minimumChargeCents,
    emergencyRateCents: row.emergencyRateCents,
    tradeRates: parseTradeRatesJson(row.tradeRatesJson),
    status: isContractorStatus(row.status) ? row.status : "PENDING",
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
