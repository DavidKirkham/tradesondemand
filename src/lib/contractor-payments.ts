export const CONTRACTOR_PAYOUT_COPY =
  "Customers pay Trades on Demand. Customer deposits and balances below are what TOD collected — not your shop payout. Shop earnings (invoice subtotal, no 20% markup) transfer to your Stripe Express balance after the invoice is paid.";

export type ContractorPaymentLike = {
  amountCents: number;
  status: string;
  type?: string;
};

export type ContractorPaymentTotals = {
  paidCents: number;
  pendingCents: number;
  refundedCents: number;
  count: number;
};

export type ContractorJobPaymentStatus = "none" | "pending" | "paid" | "partial" | "refunded";

export function sumContractorPayments(payments: ContractorPaymentLike[]): ContractorPaymentTotals {
  let paidCents = 0;
  let pendingCents = 0;
  let refundedCents = 0;
  for (const payment of payments) {
    if (payment.status === "PAID") paidCents += payment.amountCents;
    else if (payment.status === "PENDING") pendingCents += payment.amountCents;
    else if (payment.status === "REFUNDED") refundedCents += payment.amountCents;
  }
  return { paidCents, pendingCents, refundedCents, count: payments.length };
}

export function contractorJobPaymentStatus(
  payments: ContractorPaymentLike[],
): ContractorJobPaymentStatus {
  if (payments.length === 0) return "none";
  const { paidCents, pendingCents, refundedCents } = sumContractorPayments(payments);
  if (paidCents > 0 && pendingCents > 0) return "partial";
  if (paidCents > 0 && pendingCents === 0 && refundedCents === 0) return "paid";
  if (refundedCents > 0 && paidCents === 0 && pendingCents === 0) return "refunded";
  if (pendingCents > 0 && paidCents === 0) return "pending";
  if (paidCents > 0) return "partial";
  return "pending";
}

export function contractorJobPaymentLabel(status: ContractorJobPaymentStatus): string {
  switch (status) {
    case "none":
      return "No TOD payment recorded";
    case "pending":
      return "Pending with TOD";
    case "paid":
      return "Paid to TOD";
    case "partial":
      return "Partial — some paid to TOD";
    case "refunded":
      return "Refunded by TOD";
  }
}
