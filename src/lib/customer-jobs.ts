import { paymentStatusLabel, paymentTypeLabel } from "./payments";

export const PAST_CUSTOMER_JOB_STATUSES = ["COMPLETED", "CANCELLED"] as const;

export function isPastCustomerJob(status: string): boolean {
  return (PAST_CUSTOMER_JOB_STATUSES as readonly string[]).includes(status);
}

export function partitionCustomerJobs<T extends { status: string }>(jobs: T[]): {
  current: T[];
  past: T[];
} {
  const current: T[] = [];
  const past: T[] = [];
  for (const job of jobs) {
    if (isPastCustomerJob(job.status)) past.push(job);
    else current.push(job);
  }
  return { current, past };
}

export type CustomerPaymentLike = {
  id: string;
  amountCents: number;
  status: string;
  type: string;
};

export function customerPaymentTotals(payments: Pick<CustomerPaymentLike, "amountCents" | "status">[]): {
  pendingCents: number;
  paidCents: number;
  refundedCents: number;
  count: number;
} {
  let pendingCents = 0;
  let paidCents = 0;
  let refundedCents = 0;
  for (const payment of payments) {
    if (payment.status === "PENDING") pendingCents += payment.amountCents;
    else if (payment.status === "PAID") paidCents += payment.amountCents;
    else if (payment.status === "REFUNDED") refundedCents += payment.amountCents;
  }
  return { pendingCents, paidCents, refundedCents, count: payments.length };
}

export function payableCustomerPayments<T extends Pick<CustomerPaymentLike, "amountCents" | "status">>(
  payments: T[],
): T[] {
  return payments.filter((payment) => payment.status === "PENDING" && payment.amountCents > 0);
}

export function customerPaymentLine(payment: Pick<CustomerPaymentLike, "type" | "status">): string {
  return `${paymentTypeLabel(payment.type)} · ${paymentStatusLabel(payment.status)}`;
}

export function pickPayablePayment<T extends CustomerPaymentLike>(
  payments: T[],
  paymentId?: string | null,
): T | null {
  const payable = payableCustomerPayments(payments);
  if (paymentId) {
    return payable.find((payment) => payment.id === paymentId) ?? null;
  }
  return payable[0] ?? null;
}

/** Customer portal job page where Stripe Checkout is already wired. */
export function customerJobPayPath(jobPublicId: string): string {
  const id = jobPublicId.trim();
  return id ? `/account/jobs/${encodeURIComponent(id)}` : "/account";
}

export function customerJobPayUrl(origin: string, jobPublicId: string): string {
  return `${origin.replace(/\/$/, "")}${customerJobPayPath(jobPublicId)}`;
}

export type OutstandingCustomerJobPay<T extends CustomerPaymentLike = CustomerPaymentLike> = {
  jobPublicId: string;
  payPath: string;
  pendingCents: number;
  payments: T[];
};

export function outstandingCustomerJobPays<
  TJob extends { publicId: string; payments: TPayment[] },
  TPayment extends CustomerPaymentLike,
>(jobs: TJob[]): OutstandingCustomerJobPay<TPayment>[] {
  const rows: OutstandingCustomerJobPay<TPayment>[] = [];
  for (const job of jobs) {
    const payments = payableCustomerPayments(job.payments);
    if (payments.length === 0) continue;
    rows.push({
      jobPublicId: job.publicId,
      payPath: customerJobPayPath(job.publicId),
      pendingCents: payments.reduce((sum, payment) => sum + payment.amountCents, 0),
      payments,
    });
  }
  return rows;
}
