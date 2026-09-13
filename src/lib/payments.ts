import { formatUsd } from "./money";
import { rateForTrade, type TradeRate } from "./contractor";

export const PAYMENT_TYPES = ["DEPOSIT", "BALANCE", "ADJUSTMENT"] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentType(value: string): value is PaymentType {
  return (PAYMENT_TYPES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function paymentTypeLabel(type: string): string {
  switch (type) {
    case "DEPOSIT":
      return "TOD deposit";
    case "BALANCE":
      return "TOD job balance";
    case "ADJUSTMENT":
      return "TOD adjustment";
    default:
      return type;
  }
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "PAID":
      return "Paid to TOD";
    case "REFUNDED":
      return "Refunded by TOD";
    default:
      return status;
  }
}

function parsePositiveCents(raw: string | undefined): number | null {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

function smokeDepositCents(env: NodeJS.ProcessEnv = process.env): number | null {
  return (
    parsePositiveCents(env.SMOKE_DEPOSIT_CENTS) ??
    parsePositiveCents(env.NEXT_PUBLIC_SMOKE_DEPOSIT_CENTS)
  );
}

export function depositForBooking(input: {
  urgency: string;
  contractor?: {
    hourlyRateCents: number;
    minimumChargeCents: number;
    emergencyRateCents: number | null;
    tradeRates: TradeRate[];
  } | null;
  trade: string;
}): { amountCents: number; summary: string; checkoutKind: "deposit" | "minimum" | "balance" } {
  const smokeCents = smokeDepositCents();
  if (smokeCents !== null) {
    return {
      amountCents: smokeCents,
      summary: `TOD smoke deposit ${formatUsd(smokeCents)}`,
      checkoutKind: "deposit",
    };
  }

  if (input.contractor) {
    const rate = rateForTrade(input.contractor, input.trade);
    if (input.urgency === "emergency" && input.contractor.emergencyRateCents) {
      return {
        amountCents: input.contractor.emergencyRateCents,
        summary: `TOD after-hours hold ${formatUsd(input.contractor.emergencyRateCents)} (credited to the job)`,
        checkoutKind: "deposit",
      };
    }
    return {
      amountCents: rate.minimumCents,
      summary: `TOD trip minimum ${formatUsd(rate.minimumCents)} at ${formatUsd(rate.hourlyCents)}/hr`,
      checkoutKind: "minimum",
    };
  }
  if (input.urgency === "emergency") {
    return {
      amountCents: 14900,
      summary: "TOD emergency dispatch hold $149.00 (credited to the job)",
      checkoutKind: "deposit",
    };
  }
  return {
    amountCents: 0,
    summary: "No TOD trip deposit to schedule — you still pay Trades on Demand, not the contractor, when work is approved",
    checkoutKind: "deposit",
  };
}
