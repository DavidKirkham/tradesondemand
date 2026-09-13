import { formatUsd } from "./money";

/** 20% Trades on Demand platform markup, in basis points (1/100 of 1%). */
export const PLATFORM_MARKUP_BPS = 2000;

/** Contractor-basis first-available emergency hold, before platform markup. */
export const FIRST_AVAILABLE_EMERGENCY_HOLD_CENTS = 14900;
export const FIRST_AVAILABLE_EMERGENCY_HOLD_LOW_CENTS = 8900;

const BPS_DENOMINATOR = 10_000;

export function applyPlatformMarkupCents(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  const contractorCents = Math.trunc(cents);
  if (contractorCents <= 0) return 0;
  const marked = contractorCents * (BPS_DENOMINATOR + PLATFORM_MARKUP_BPS);
  return Math.floor((marked + BPS_DENOMINATOR / 2) / BPS_DENOMINATOR);
}

/** Alias used at Checkout / Payment creation: customer cents from contractor cost basis. */
export function markupCustomerCents(contractorCents: number): number {
  return applyPlatformMarkupCents(contractorCents);
}

export function platformMarkupCents(contractorCents: number): number {
  if (!Number.isFinite(contractorCents) || contractorCents <= 0) return 0;
  const contractor = Math.trunc(contractorCents);
  return Math.max(0, applyPlatformMarkupCents(contractor) - contractor);
}

export function formatCustomerUsd(contractorCents: number): string {
  return formatUsd(applyPlatformMarkupCents(contractorCents));
}

export function formatShopAndCustomerUsd(contractorCents: number): string {
  return `${formatUsd(contractorCents)} shop · ${formatCustomerUsd(contractorCents)} customer`;
}
