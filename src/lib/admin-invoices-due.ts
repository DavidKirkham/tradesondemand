import {
  customerFacingInvoiceTotals,
  invoiceHasStoredMarkup,
  type InvoiceMoneyFields,
} from "./invoice";
import {
  INVOICE_MARKUP_OMIT,
  isMissingInvoiceMarkupColumn,
  isMissingInvoiceModel,
} from "./invoice-columns";
import { prisma } from "./prisma";

export const INVOICE_DUE_SORTS = ["oldest", "amount"] as const;
export type InvoiceDueSort = (typeof INVOICE_DUE_SORTS)[number];

export type InvoiceDuePayment = {
  status: string;
  type?: string;
  amountCents: number;
};

export type InvoiceDueSource = InvoiceMoneyFields & {
  id: string;
  publicId: string;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  booking: {
    id: string;
    publicId: string;
    customerName: string;
    customer?: { id: string; name: string } | null;
    contractor?: { id: string; businessName: string } | null;
  };
  payment?: InvoiceDuePayment | null;
};

export type AdminInvoiceDueRow = {
  invoiceId: string;
  invoicePublicId: string;
  jobId: string;
  jobPublicId: string;
  jobHref: string;
  clientId: string | null;
  clientName: string;
  contractorId: string | null;
  contractorName: string | null;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  amountDueCents: number;
  shopSubtotalCents: number;
  customerSubtotalCents: number;
  markupCents: number;
  hasMarkup: boolean;
};

export function isInvoiceDueSort(value: string | undefined | null): value is InvoiceDueSort {
  return value === "oldest" || value === "amount";
}

export function parseInvoiceDueSort(value?: string | null): InvoiceDueSort {
  return value === "amount" ? "amount" : "oldest";
}

export function adminInvoiceDueHref(jobId: string): string {
  return `/admin/jobs/${jobId}#invoice`;
}

export function invoiceIsOutstandingDue(invoice: {
  status: string;
  amountDueCents: number;
  payment?: InvoiceDuePayment | null;
}): boolean {
  if (invoice.status === "PAID") return false;
  if (invoice.amountDueCents > 0) return true;
  const payment = invoice.payment;
  if (!payment || payment.status !== "PENDING" || payment.amountCents <= 0) return false;
  return !payment.type || payment.type === "BALANCE";
}

function dueSortTime(row: { sentAt: Date | null; createdAt: Date }): number {
  return (row.sentAt ?? row.createdAt).getTime();
}

export function sortInvoicesDue<T extends { amountDueCents: number; sentAt: Date | null; createdAt: Date }>(
  rows: T[],
  sort: InvoiceDueSort = "oldest",
): T[] {
  return [...rows].sort((a, b) => {
    if (sort === "amount") {
      const byAmount = b.amountDueCents - a.amountDueCents;
      if (byAmount !== 0) return byAmount;
      return dueSortTime(a) - dueSortTime(b);
    }
    const byDate = dueSortTime(a) - dueSortTime(b);
    if (byDate !== 0) return byDate;
    return b.amountDueCents - a.amountDueCents;
  });
}

export function toAdminInvoiceDueRow(invoice: InvoiceDueSource): AdminInvoiceDueRow | null {
  if (!invoiceIsOutstandingDue(invoice)) return null;
  const customer = customerFacingInvoiceTotals(invoice);
  return {
    invoiceId: invoice.id,
    invoicePublicId: invoice.publicId,
    jobId: invoice.booking.id,
    jobPublicId: invoice.booking.publicId,
    jobHref: adminInvoiceDueHref(invoice.booking.id),
    clientId: invoice.booking.customer?.id ?? null,
    clientName: invoice.booking.customer?.name ?? invoice.booking.customerName,
    contractorId: invoice.booking.contractor?.id ?? null,
    contractorName: invoice.booking.contractor?.businessName ?? null,
    status: invoice.status,
    sentAt: invoice.sentAt,
    createdAt: invoice.createdAt,
    amountDueCents: invoice.amountDueCents,
    shopSubtotalCents: invoice.subtotalCents,
    customerSubtotalCents: customer.subtotalCents,
    markupCents: customer.markupCents,
    hasMarkup: invoiceHasStoredMarkup(invoice),
  };
}

export function outstandingInvoicesDue(
  invoices: InvoiceDueSource[],
  sort: InvoiceDueSort = "oldest",
): AdminInvoiceDueRow[] {
  const rows = invoices.flatMap((invoice) => {
    const row = toAdminInvoiceDueRow(invoice);
    return row ? [row] : [];
  });
  return sortInvoicesDue(rows, sort);
}

export function filterInvoicesDue(rows: AdminInvoiceDueRow[], q: string): AdminInvoiceDueRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    return (
      row.jobPublicId.toLowerCase().includes(needle) ||
      row.invoicePublicId.toLowerCase().includes(needle) ||
      row.clientName.toLowerCase().includes(needle) ||
      (row.contractorName?.toLowerCase().includes(needle) ?? false)
    );
  });
}

export function invoicesDueTotalCents(rows: Pick<AdminInvoiceDueRow, "amountDueCents">[]): number {
  return rows.reduce((sum, row) => sum + row.amountDueCents, 0);
}

export function formatInvoiceDueDate(value: Date | null | undefined): string {
  if (!value) return "Not sent";
  return value.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const invoiceDueInclude = {
  booking: {
    select: {
      id: true,
      publicId: true,
      customerName: true,
      customer: { select: { id: true, name: true } },
      contractor: { select: { id: true, businessName: true } },
    },
  },
  payment: { select: { status: true, type: true, amountCents: true } },
};

const invoiceDueWhere = {
  status: { not: "PAID" },
  OR: [{ amountDueCents: { gt: 0 } }, { payment: { is: { status: "PENDING" } } }],
};

function mapLoadedInvoices(
  rows: InvoiceDueSource[],
  sort: InvoiceDueSort,
): AdminInvoiceDueRow[] {
  return outstandingInvoicesDue(rows, sort);
}

export async function loadInvoicesDue(sort: InvoiceDueSort = "oldest"): Promise<AdminInvoiceDueRow[]> {
  try {
    const rows = await prisma.invoice.findMany({
      where: invoiceDueWhere,
      include: invoiceDueInclude,
    });
    return mapLoadedInvoices(rows, sort);
  } catch (error) {
    if (isMissingInvoiceMarkupColumn(error)) {
      const rows = await prisma.invoice.findMany({
        where: invoiceDueWhere,
        omit: INVOICE_MARKUP_OMIT,
        include: invoiceDueInclude,
      });
      return mapLoadedInvoices(
        rows.map((row) => ({ ...row, customerSubtotalCents: 0, markupCents: 0 })),
        sort,
      );
    }
    if (isMissingInvoiceModel(error)) return [];
    throw error;
  }
}

export async function countInvoicesDue(): Promise<number> {
  try {
    return await prisma.invoice.count({
      where: {
        status: { not: "PAID" },
        amountDueCents: { gt: 0 },
      },
    });
  } catch (error) {
    if (isMissingInvoiceModel(error)) return 0;
    throw error;
  }
}
