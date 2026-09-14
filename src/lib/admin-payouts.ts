import { formatUsd } from "./money";
import {
  contractorConnectStatusCopy,
  contractorConnectStatusLabel,
  contractorPayoutStatusLabel,
  isMissingContractorPayoutModel,
  transferEligibility,
} from "./contractor-payouts";
import { prisma } from "./prisma";
import { ensureContractorPayoutForPaidInvoice } from "./contractor-connect";

export type AdminPayoutQueueRow = {
  payoutId: string;
  publicId: string;
  jobId: string;
  jobPublicId: string;
  jobHref: string;
  invoicePublicId: string;
  contractorId: string | null;
  contractorName: string | null;
  contractorHref: string | null;
  shopAmountCents: number;
  customerSubtotalCents: number;
  markupCents: number;
  status: string;
  statusLabel: string;
  failureMessage: string | null;
  stripeTransferId: string | null;
  connectStatus: ReturnType<typeof contractorConnectStatusLabel> | "unassigned";
  connectLabel: string;
  canTransfer: boolean;
  transferBlockedReason: string | null;
  createdAt: Date;
  transferredAt: Date | null;
};

export function toAdminPayoutQueueRow(payout: {
  id: string;
  publicId: string;
  status: string;
  shopAmountCents: number;
  failureMessage: string | null;
  stripeTransferId: string | null;
  createdAt: Date;
  transferredAt: Date | null;
  booking: { id: string; publicId: string };
  invoice: { publicId: string; status: string; customerSubtotalCents: number; markupCents: number };
  contractor: {
    id: string;
    businessName: string;
    stripeConnectAccountId: string | null;
    stripeConnectOnboarded: boolean;
    stripeConnectPayoutsEnabled: boolean;
  } | null;
}): AdminPayoutQueueRow {
  const connectStatus = payout.contractor
    ? contractorConnectStatusLabel(payout.contractor)
    : "unassigned";
  const eligibility = transferEligibility({
    payoutStatus: payout.status,
    shopAmountCents: payout.shopAmountCents,
    invoiceStatus: payout.invoice.status,
    contractorId: payout.contractor?.id ?? null,
    stripeConnectAccountId: payout.contractor?.stripeConnectAccountId ?? null,
    stripeConnectPayoutsEnabled: payout.contractor?.stripeConnectPayoutsEnabled ?? false,
  });
  return {
    payoutId: payout.id,
    publicId: payout.publicId,
    jobId: payout.booking.id,
    jobPublicId: payout.booking.publicId,
    jobHref: `/admin/jobs/${payout.booking.id}`,
    invoicePublicId: payout.invoice.publicId,
    contractorId: payout.contractor?.id ?? null,
    contractorName: payout.contractor?.businessName ?? null,
    contractorHref: payout.contractor ? `/admin/contractors/${payout.contractor.id}` : null,
    shopAmountCents: payout.shopAmountCents,
    customerSubtotalCents: payout.invoice.customerSubtotalCents,
    markupCents: payout.invoice.markupCents,
    status: payout.status,
    statusLabel: contractorPayoutStatusLabel(payout.status),
    failureMessage: payout.failureMessage,
    stripeTransferId: payout.stripeTransferId,
    connectStatus,
    connectLabel:
      connectStatus === "unassigned" ? "Unassigned" : contractorConnectStatusCopy(connectStatus),
    canTransfer: eligibility.ok,
    transferBlockedReason: eligibility.ok ? null : eligibility.code,
    createdAt: payout.createdAt,
    transferredAt: payout.transferredAt,
  };
}

export function filterPayoutQueue(rows: AdminPayoutQueueRow[], q: string): AdminPayoutQueueRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    return (
      row.jobPublicId.toLowerCase().includes(needle) ||
      row.invoicePublicId.toLowerCase().includes(needle) ||
      row.publicId.toLowerCase().includes(needle) ||
      (row.contractorName?.toLowerCase().includes(needle) ?? false)
    );
  });
}

export function owedPayoutTotalCents(rows: Pick<AdminPayoutQueueRow, "status" | "shopAmountCents">[]): number {
  return rows
    .filter((row) => row.status === "PENDING" || row.status === "FAILED")
    .reduce((sum, row) => sum + row.shopAmountCents, 0);
}

export function payoutQueueHint(row: AdminPayoutQueueRow): string {
  if (row.status === "PAID") {
    return row.stripeTransferId ? `Transfer ${row.stripeTransferId}` : "Transferred";
  }
  if (row.failureMessage) return row.failureMessage;
  if (row.transferBlockedReason === "needs_onboarding") return "Shop needs Express onboarding";
  if (row.transferBlockedReason === "payouts_disabled") return "Transfers not enabled on Connect yet";
  return `Customer paid TOD ${formatUsd(row.customerSubtotalCents)}; markup ${formatUsd(row.markupCents)} stays with TOD`;
}

export async function loadPayoutQueue(): Promise<AdminPayoutQueueRow[]> {
  try {
    const unpaid = await prisma.invoice.findMany({
      where: { status: "PAID", payout: null, subtotalCents: { gt: 0 } },
      select: { id: true },
      take: 50,
    });
    for (const invoice of unpaid) {
      await ensureContractorPayoutForPaidInvoice(invoice.id);
    }
    const rows = await prisma.contractorPayout.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        booking: { select: { id: true, publicId: true } },
        invoice: {
          select: { publicId: true, status: true, customerSubtotalCents: true, markupCents: true },
        },
        contractor: {
          select: {
            id: true,
            businessName: true,
            stripeConnectAccountId: true,
            stripeConnectOnboarded: true,
            stripeConnectPayoutsEnabled: true,
          },
        },
      },
    });
    const mapped = rows.map(toAdminPayoutQueueRow);
    return mapped.sort((a, b) => {
      const rank = (status: string) => (status === "FAILED" ? 0 : status === "PENDING" ? 1 : 2);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return [];
    throw error;
  }
}

export async function countOwedPayouts(): Promise<number> {
  try {
    return await prisma.contractorPayout.count({
      where: { status: { in: ["PENDING", "FAILED"] } },
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return 0;
    throw error;
  }
}
