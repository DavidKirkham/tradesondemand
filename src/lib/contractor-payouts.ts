import { randomBytes } from "node:crypto";
import { isSchemaMismatchError } from "./api-errors";

export const CONTRACTOR_PAYOUT_STATUSES = ["PENDING", "PAID", "FAILED"] as const;
export type ContractorPayoutStatus = (typeof CONTRACTOR_PAYOUT_STATUSES)[number];

/**
 * Contractor payout obligation (shop earnings) — v1 rule:
 *
 * Customers pay TOD the marked-up total (invoice.customerSubtotalCents). TOD keeps
 * the 20% platform markup. The contractor never receives customer cents.
 *
 * Payable when the TOD invoice is PAID: the customer paid the remaining Checkout
 * balance, or a prior deposit already covered customerSubtotal so sending the
 * invoice marked it PAID immediately.
 *
 * Amount = invoice.subtotalCents (shop labor + materials). Deposits are a
 * customer-side credit against the marked-up total; they do not convert into
 * shop cents and do not change contractor earnings. There is no partial
 * deposit-attribution payout. No invoice → no payout, even if a deposit posted.
 *
 * One ContractorPayout row per invoice. Already-created rows (PENDING / PAID /
 * FAILED) occupy the obligation so retries cannot double-create.
 */
export function shopEarningsCents(invoice: { subtotalCents: number }): number {
  if (!Number.isFinite(invoice.subtotalCents) || invoice.subtotalCents <= 0) return 0;
  return Math.trunc(invoice.subtotalCents);
}

export function invoiceIsPayableForPayout(invoice: { status: string; subtotalCents: number }): boolean {
  return invoice.status === "PAID" && shopEarningsCents(invoice) > 0;
}

export function occupiedPayoutCents(
  payouts: { shopAmountCents: number; status: string }[],
): number {
  let occupied = 0;
  for (const payout of payouts) {
    if (payout.status === "PENDING" || payout.status === "PAID" || payout.status === "FAILED") {
      occupied += payout.shopAmountCents;
    }
  }
  return occupied;
}

export function remainingShopPayoutCents(input: {
  shopSubtotalCents: number;
  existingPayouts: { shopAmountCents: number; status: string }[];
}): number {
  const shop = Math.max(0, Math.trunc(input.shopSubtotalCents));
  return Math.max(0, shop - occupiedPayoutCents(input.existingPayouts));
}

export function createPayoutPublicId(): string {
  return `XFR-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function isContractorPayoutStatus(value: string): value is ContractorPayoutStatus {
  return (CONTRACTOR_PAYOUT_STATUSES as readonly string[]).includes(value);
}

export function contractorPayoutStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Owed — not transferred";
    case "PAID":
      return "Transferred to shop";
    case "FAILED":
      return "Transfer failed";
    default:
      return status;
  }
}

export function contractorConnectStatusLabel(input: {
  stripeConnectAccountId: string | null;
  stripeConnectOnboarded: boolean;
  stripeConnectPayoutsEnabled: boolean;
}): "needs_onboarding" | "pending_review" | "ready" {
  if (!input.stripeConnectAccountId || !input.stripeConnectOnboarded) return "needs_onboarding";
  if (!input.stripeConnectPayoutsEnabled) return "pending_review";
  return "ready";
}

export function contractorConnectStatusCopy(
  status: ReturnType<typeof contractorConnectStatusLabel>,
): string {
  switch (status) {
    case "needs_onboarding":
      return "Needs Stripe onboarding";
    case "pending_review":
      return "Stripe is reviewing payouts";
    case "ready":
      return "Ready for shop payouts";
  }
}

export type TransferEligibility =
  | { ok: true }
  | { ok: false; code: "not_payable" | "already_paid" | "needs_onboarding" | "payouts_disabled" | "no_amount" | "unassigned" };

export function transferEligibility(input: {
  payoutStatus: string;
  shopAmountCents: number;
  invoiceStatus: string;
  contractorId: string | null;
  stripeConnectAccountId: string | null;
  stripeConnectPayoutsEnabled: boolean;
}): TransferEligibility {
  if (!input.contractorId) return { ok: false, code: "unassigned" };
  if (input.payoutStatus === "PAID") return { ok: false, code: "already_paid" };
  if (input.payoutStatus !== "PENDING" && input.payoutStatus !== "FAILED") {
    return { ok: false, code: "not_payable" };
  }
  if (input.invoiceStatus !== "PAID") return { ok: false, code: "not_payable" };
  if (input.shopAmountCents <= 0) return { ok: false, code: "no_amount" };
  if (!input.stripeConnectAccountId) return { ok: false, code: "needs_onboarding" };
  if (!input.stripeConnectPayoutsEnabled) return { ok: false, code: "payouts_disabled" };
  return { ok: true };
}

export function transferEligibilityMessage(code: Exclude<TransferEligibility, { ok: true }>["code"]): string {
  switch (code) {
    case "already_paid":
      return "This shop payout was already transferred.";
    case "not_payable":
      return "Shop earnings are not payable until the customer invoice is paid to TOD.";
    case "needs_onboarding":
      return "This shop still needs to finish Stripe Express onboarding.";
    case "payouts_disabled":
      return "Stripe has not enabled transfers on this shop’s Express account yet.";
    case "no_amount":
      return "There is no shop amount to transfer.";
    case "unassigned":
      return "This payout has no assigned contractor.";
  }
}

export function transferIdempotencyKey(payout: {
  id: string;
  stripeTransferId: string | null;
  updatedAt: Date;
}): string {
  if (!payout.stripeTransferId) return `tod_payout_${payout.id}`;
  return `tod_payout_${payout.id}_retry_${payout.updatedAt.getTime()}`;
}

export function isMissingContractorPayoutModel(error: unknown): boolean {
  if (!isSchemaMismatchError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /ContractorPayout|stripeConnectAccountId|stripeConnectOnboarded|stripeConnectPayoutsEnabled/i.test(
    message,
  );
}
