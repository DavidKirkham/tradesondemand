import { validateBookingInput, type BookingInput, type BookingValidation } from "./booking";
import { jobFitsContractor } from "./contractor-app";
import { parseTradeRatesJson, parseTradesJson, type TradeRate } from "./contractor";
import { nationalUsDigits } from "./phone";
import { depositForBooking } from "./payments";
import type { AdminContractorOption } from "./admin-assign";

export const PHONE_PLACEHOLDER_EMAIL_DOMAIN = "phone.tradesondemand.invalid";

export type AdminIntakeInput = BookingInput & {
  notes?: string;
  preferredTime?: string;
  skipDeposit?: boolean;
};

export type ValidatedAdminIntake = {
  trade: string;
  problem: string;
  urgency: "emergency" | "routine";
  street: string;
  city: string;
  state: "MO" | "KS";
  zip: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  emailProvided: boolean;
  quoteSummary: string;
  contractorId: string;
  notes: string;
  preferredTime: string;
  skipDeposit: boolean;
};

export type AdminIntakeValidation =
  | { ok: true; data: ValidatedAdminIntake }
  | { ok: false; message: string; field?: string };

export type IntakeCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type IntakeCustomerStore = {
  findByPhone: (phone: string) => Promise<IntakeCustomer | null>;
  findByEmail: (email: string) => Promise<IntakeCustomer | null>;
  create: (data: {
    name: string;
    email: string;
    phone: string;
    token: string;
  }) => Promise<IntakeCustomer>;
  update: (
    id: string,
    data: { name?: string; email?: string; phone?: string },
  ) => Promise<IntakeCustomer>;
};

export type IntakeLastAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type AdminIntakeContractorOption = AdminContractorOption & {
  serviceArea: string;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  tradeRates: TradeRate[];
  phone: string;
  tradesJson: string;
};

export function phonePlaceholderEmail(phone: string): string {
  return `${nationalUsDigits(phone)}@${PHONE_PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPhonePlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PHONE_PLACEHOLDER_EMAIL_DOMAIN}`);
}

export function composeIntakeProblem(problem: string, notes: string, preferredTime: string): string {
  const parts = [problem.trim()];
  const time = preferredTime.trim();
  const extra = notes.trim();
  if (time) parts.push(`Preferred time: ${time}`);
  if (extra) parts.push(`Dispatch notes: ${extra}`);
  return parts.join("\n\n");
}

export function intakeDeposit(input: {
  skipDeposit: boolean;
  urgency: string;
  trade: string;
  contractor?: Parameters<typeof depositForBooking>[0]["contractor"];
}): { amountCents: number; summary: string; checkoutKind: "deposit" | "minimum" | "balance"; skipped: boolean } {
  if (input.skipDeposit) {
    return {
      amountCents: 0,
      summary: "Deposit skipped for phone dispatch",
      checkoutKind: "deposit",
      skipped: true,
    };
  }
  const deposit = depositForBooking({
    urgency: input.urgency,
    trade: input.trade,
    contractor: input.contractor ?? null,
  });
  return { ...deposit, skipped: false };
}

export function depositNoteForIntake(deposit: { amountCents: number; skipped: boolean }): string {
  if (deposit.skipped || deposit.amountCents === 0) {
    return "Deposit skipped for phone dispatch. Future job balance is paid to Trades on Demand (Trademark Walls), not the contractor.";
  }
  return "Pending TOD deposit hold from phone dispatch — collect later. You pay Trades on Demand, not the contractor.";
}

export function validateAdminIntakeInput(input: AdminIntakeInput): AdminIntakeValidation {
  const contractorId = input.contractorId?.trim() || "";
  if (!contractorId) {
    return { ok: false, field: "contractorId", message: "Pick an approved contractor to assign this call." };
  }

  const emailRaw = input.customerEmail?.trim() ?? "";
  const phoneDigits = nationalUsDigits(input.customerPhone ?? "");
  const bookingEmail = emailRaw || (phoneDigits.length === 10 ? phonePlaceholderEmail(phoneDigits) : "dispatch@phone.tradesondemand.invalid");

  const parsed: BookingValidation = validateBookingInput({
    trade: input.trade,
    problem: input.problem,
    urgency: input.urgency,
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: bookingEmail,
    contractorId,
    matchPreference: "SPECIFIC",
  });
  if (!parsed.ok) return parsed;

  const notes = (input.notes ?? "").trim();
  const preferredTime = (input.preferredTime ?? "").trim();

  return {
    ok: true,
    data: {
      trade: parsed.data.trade,
      problem: composeIntakeProblem(parsed.data.problem, notes, preferredTime),
      urgency: parsed.data.urgency,
      street: parsed.data.street,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: emailRaw ? parsed.data.customerEmail : phonePlaceholderEmail(parsed.data.customerPhone),
      emailProvided: Boolean(emailRaw),
      quoteSummary: parsed.data.quoteSummary,
      contractorId,
      notes,
      preferredTime,
      skipDeposit: Boolean(input.skipDeposit),
    },
  };
}

export function pickMatchingIntakeCustomer(
  byPhone: IntakeCustomer | null,
  byEmail: IntakeCustomer | null,
): IntakeCustomer | null {
  return byPhone ?? byEmail;
}

export async function matchOrCreateIntakeCustomer(
  input: {
    name: string;
    phone: string;
    email: string;
    emailProvided: boolean;
    token: string;
  },
  store: IntakeCustomerStore,
): Promise<{ customer: IntakeCustomer; created: boolean }> {
  const byPhone = await store.findByPhone(input.phone);
  const emailForLookup = input.emailProvided ? input.email : phonePlaceholderEmail(input.phone);
  const byEmail = await store.findByEmail(emailForLookup);
  const existing = pickMatchingIntakeCustomer(byPhone, byEmail);

  if (existing) {
    const patch: { name: string; email?: string; phone?: string } = { name: input.name };
    if (!byPhone) patch.phone = input.phone;
    if (input.emailProvided && input.email !== existing.email) {
      const taken = input.email === existing.email ? existing : await store.findByEmail(input.email);
      if (!taken || taken.id === existing.id) {
        patch.email = input.email;
      }
    }
    const updated = await store.update(existing.id, patch);
    return { customer: updated, created: false };
  }

  const customer = await store.create({
    name: input.name,
    phone: input.phone,
    email: input.emailProvided ? input.email : phonePlaceholderEmail(input.phone),
    token: input.token,
  });
  return { customer, created: true };
}

export function contractorCoversIntakeJob(
  contractor: Pick<AdminIntakeContractorOption, "tradesJson" | "serviceArea" | "trades">,
  job: { trade: string; city: string; zip: string },
): boolean {
  const tradesJson = contractor.tradesJson || JSON.stringify(contractor.trades ?? []);
  return jobFitsContractor(job, { tradesJson, serviceArea: contractor.serviceArea });
}

export function partitionIntakeContractors(
  contractors: AdminIntakeContractorOption[],
  trade: string,
  city: string,
  zip: string,
): {
  matching: AdminIntakeContractorOption[];
  otherCoverage: AdminIntakeContractorOption[];
  otherTrade: AdminIntakeContractorOption[];
} {
  const matching: AdminIntakeContractorOption[] = [];
  const otherCoverage: AdminIntakeContractorOption[] = [];
  const otherTrade: AdminIntakeContractorOption[] = [];
  for (const shop of contractors) {
    if (trade && !shop.trades.includes(trade)) {
      otherTrade.push(shop);
      continue;
    }
    if (!city && !zip) {
      matching.push(shop);
      continue;
    }
    if (contractorCoversIntakeJob(shop, { trade, city, zip })) matching.push(shop);
    else otherCoverage.push(shop);
  }
  return { matching, otherCoverage, otherTrade };
}

export function filterContractorsByQuery(
  contractors: AdminIntakeContractorOption[],
  query: string,
): AdminIntakeContractorOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return contractors;
  return contractors.filter((shop) => {
    const haystack = [shop.businessName, shop.publicId, shop.serviceArea, ...shop.trades]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function toAdminIntakeContractor(row: {
  id: string;
  businessName: string;
  publicId: string;
  tradesJson: string;
  serviceArea: string;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  tradeRatesJson: string;
  phone: string;
}): AdminIntakeContractorOption {
  return {
    id: row.id,
    businessName: row.businessName,
    publicId: row.publicId,
    trades: parseTradesJson(row.tradesJson),
    serviceArea: row.serviceArea,
    hourlyRateCents: row.hourlyRateCents,
    minimumChargeCents: row.minimumChargeCents,
    emergencyRateCents: row.emergencyRateCents,
    tradeRates: parseTradeRatesJson(row.tradeRatesJson),
    phone: row.phone,
    tradesJson: row.tradesJson,
  };
}
