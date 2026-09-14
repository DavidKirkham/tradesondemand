import {
  customerFacingInvoiceTotals,
  depositCreditCents,
  invoiceHasStoredMarkup,
  toInvoiceLineDrafts,
  type InvoiceLineDraft,
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

export type InvoiceDueLine = {
  kind: string;
  description: string;
  quantity: string;
  unitCents: number;
  amountCents: number;
};

export type InvoiceDueSource = InvoiceMoneyFields & {
  id: string;
  publicId: string;
  status: string;
  note?: string | null;
  paymentId?: string | null;
  sentAt: Date | null;
  createdAt: Date;
  lines?: InvoiceDueLine[];
  booking: {
    id: string;
    publicId: string;
    customerName: string;
    customer?: { id: string; name: string } | null;
    contractor?: { id: string; businessName: string } | null;
    payments?: { id: string; amountCents: number; status: string }[];
  };
  payment?: InvoiceDuePayment | null;
};

export type AdminInvoiceDueEditor = {
  jobId: string;
  depositPaidCents: number;
  invoice: {
    publicId: string;
    status: string;
    note: string | null;
    laborCents: number;
    materialsCents: number;
    subtotalCents: number;
    customerSubtotalCents: number;
    markupCents: number;
    depositPaidCents: number;
    amountDueCents: number;
    lines: InvoiceLineDraft[];
  };
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
  sentAtLabel: string;
  amountDueCents: number;
  shopSubtotalCents: number;
  customerSubtotalCents: number;
  markupCents: number;
  discountCents: number;
  hasMarkup: boolean;
  editor: AdminInvoiceDueEditor;
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
  const lines = toInvoiceLineDrafts(invoice.lines ?? []);
  const discountCents = lines
    .filter((line) => line.kind === "DISCOUNT")
    .reduce((sum, line) => sum + line.amountCents, 0);
  const depositPaidCents = invoice.booking.payments
    ? depositCreditCents(invoice.booking.payments, invoice.paymentId)
    : invoice.depositPaidCents;
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
    sentAtLabel: formatInvoiceDueDate(invoice.sentAt),
    amountDueCents: invoice.amountDueCents,
    shopSubtotalCents: invoice.subtotalCents,
    customerSubtotalCents: customer.subtotalCents,
    markupCents: customer.markupCents,
    discountCents,
    hasMarkup: invoiceHasStoredMarkup(invoice),
    editor: {
      jobId: invoice.booking.id,
      depositPaidCents,
      invoice: {
        publicId: invoice.publicId,
        status: invoice.status,
        note: invoice.note ?? null,
        laborCents: invoice.laborCents,
        materialsCents: invoice.materialsCents,
        subtotalCents: invoice.subtotalCents,
        customerSubtotalCents: invoice.customerSubtotalCents ?? 0,
        markupCents: invoice.markupCents ?? 0,
        depositPaidCents: invoice.depositPaidCents,
        amountDueCents: invoice.amountDueCents,
        lines,
      },
    },
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

type SavedInvoiceForDueRow = Omit<
  AdminInvoiceDueEditor["invoice"],
  "customerSubtotalCents" | "markupCents"
> & {
  customerSubtotalCents?: number | null;
  markupCents?: number | null;
};

export function applySavedInvoiceToDueRow<T extends AdminInvoiceDueRow | Omit<AdminInvoiceDueRow, "sentAt" | "createdAt">>(
  row: T,
  saved: SavedInvoiceForDueRow,
): T | null {
  if (saved.status === "PAID" || saved.amountDueCents <= 0) return null;
  const customerSubtotalCents = saved.customerSubtotalCents ?? 0;
  const markupCents = saved.markupCents ?? 0;
  const invoice: AdminInvoiceDueEditor["invoice"] = {
    ...saved,
    customerSubtotalCents,
    markupCents,
  };
  const discountCents = saved.lines
    .filter((line) => line.kind === "DISCOUNT")
    .reduce((sum, line) => sum + line.amountCents, 0);
  return {
    ...row,
    status: saved.status,
    amountDueCents: saved.amountDueCents,
    shopSubtotalCents: saved.subtotalCents,
    customerSubtotalCents,
    markupCents,
    discountCents,
    hasMarkup: customerSubtotalCents > 0,
    editor: {
      ...row.editor,
      invoice,
    },
  };
}

export function invoicesDueTotalCents(rows: Pick<AdminInvoiceDueRow, "amountDueCents">[]): number {
  return rows.reduce((sum, row) => sum + row.amountDueCents, 0);
}

export function toAdminInvoiceDueTableRow(
  row: AdminInvoiceDueRow,
): Omit<AdminInvoiceDueRow, "sentAt" | "createdAt"> {
  return {
    invoiceId: row.invoiceId,
    invoicePublicId: row.invoicePublicId,
    jobId: row.jobId,
    jobPublicId: row.jobPublicId,
    jobHref: row.jobHref,
    clientId: row.clientId,
    clientName: row.clientName,
    contractorId: row.contractorId,
    contractorName: row.contractorName,
    status: row.status,
    sentAtLabel: row.sentAtLabel,
    amountDueCents: row.amountDueCents,
    shopSubtotalCents: row.shopSubtotalCents,
    customerSubtotalCents: row.customerSubtotalCents,
    markupCents: row.markupCents,
    discountCents: row.discountCents,
    hasMarkup: row.hasMarkup,
    editor: row.editor,
  };
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
      payments: { select: { id: true, amountCents: true, status: true } },
    },
  },
  payment: { select: { status: true, type: true, amountCents: true } },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      kind: true,
      description: true,
      quantity: true,
      unitCents: true,
      amountCents: true,
    },
  },
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
