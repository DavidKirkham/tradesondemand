import { ensureContractorPayoutForPaidInvoice } from "./contractor-connect";
import { depositCreditCents, toInvoiceLineDrafts, totalsFromLines, validateInvoicePayload } from "./invoice";
import { isMissingInvoiceMarkupColumn, INVOICE_MARKUP_OMIT } from "./invoice-columns";
import {
  invoiceLockedReason,
  persistInvoiceEdits,
  type ExistingInvoiceRow,
  type InvoicePaymentRow,
  type PersistInvoiceInput,
} from "./invoice-persist";
import type { InvoiceRevalidateSurfaces } from "./invoice-revalidate";
import { formatUsd } from "./money";
import { prisma } from "./prisma";

export type AdminInvoicePayload = {
  labor?: { description?: string; hours?: string; rate?: string }[];
  materials?: { description?: string; cost?: string }[];
  discounts?: { description?: string; amount?: string }[];
  note?: string;
};

export type AdminInvoiceJob = {
  id: string;
  publicId: string;
  token?: string;
  status: string;
  customerId: string | null;
  contractorId: string | null;
  payments: InvoicePaymentRow[];
};

export type PersistedAdminInvoice = Awaited<ReturnType<typeof persistInvoiceEdits>>;

export type AdminInvoiceStore = {
  findJob: (id: string) => Promise<AdminInvoiceJob | null>;
  findInvoice: (bookingId: string) => Promise<ExistingInvoiceRow | null>;
  persist: (
    input: PersistInvoiceInput & { jobStatus: string; eventNote: string },
  ) => Promise<PersistedAdminInvoice>;
};

export type PublicAdminInvoice = {
  id: string;
  publicId: string;
  bookingId: string;
  status: string;
  note: string | null;
  laborCents: number;
  materialsCents: number;
  subtotalCents: number;
  customerSubtotalCents: number;
  markupCents: number;
  depositPaidCents: number;
  amountDueCents: number;
  lines: ReturnType<typeof toInvoiceLineDrafts>;
  payment: {
    id: string;
    status: string;
    amountCents: number;
    type?: string;
    stripeCheckoutSessionId?: string | null;
  } | null;
};

export type SaveAdminInvoiceResult =
  | { ok: true; invoice: PersistedAdminInvoice; publicInvoice: PublicAdminInvoice; surfaces: InvoiceRevalidateSurfaces }
  | { ok: false; status: 400 | 404; error: string };

export function defaultAdminInvoiceStore(): AdminInvoiceStore {
  return {
    async findJob(id) {
      return prisma.booking.findFirst({
        where: { OR: [{ id }, { publicId: id }] },
        select: {
          id: true,
          publicId: true,
          token: true,
          status: true,
          customerId: true,
          contractorId: true,
          payments: { select: { id: true, amountCents: true, status: true, type: true, stripeCheckoutSessionId: true } },
        },
      });
    },
    async findInvoice(bookingId) {
      return loadInvoiceForAdminEdit(bookingId);
    },
    async persist(input) {
      try {
        return await writeAdminInvoice(input);
      } catch (error) {
        if (!isMissingInvoiceMarkupColumn(error)) throw error;
        return writeAdminInvoice({ ...input, omitMarkupColumns: true });
      }
    },
  };
}

export async function loadInvoiceForAdminEdit(bookingId: string): Promise<ExistingInvoiceRow | null> {
  const paymentSelect = {
    id: true,
    status: true,
    amountCents: true,
    type: true,
    stripeCheckoutSessionId: true,
  } as const;
  try {
    return await prisma.invoice.findUnique({
      where: { bookingId },
      include: { payment: { select: paymentSelect } },
    });
  } catch (error) {
    if (!isMissingInvoiceMarkupColumn(error)) throw error;
    const invoice = await prisma.invoice.findUnique({
      where: { bookingId },
      omit: INVOICE_MARKUP_OMIT,
      include: { payment: { select: paymentSelect } },
    });
    return invoice;
  }
}

export function publicAdminInvoice(invoice: PersistedAdminInvoice): PublicAdminInvoice {
  return {
    id: invoice.id,
    publicId: invoice.publicId,
    bookingId: invoice.bookingId,
    status: invoice.status,
    note: invoice.note,
    laborCents: invoice.laborCents,
    materialsCents: invoice.materialsCents,
    subtotalCents: invoice.subtotalCents,
    customerSubtotalCents: invoice.customerSubtotalCents ?? 0,
    markupCents: invoice.markupCents ?? 0,
    depositPaidCents: invoice.depositPaidCents,
    amountDueCents: invoice.amountDueCents,
    lines: toInvoiceLineDrafts(invoice.lines ?? []),
    payment: invoice.payment
      ? {
          id: invoice.payment.id,
          status: invoice.payment.status,
          amountCents: invoice.payment.amountCents,
          type: invoice.payment.type,
          stripeCheckoutSessionId: invoice.payment.stripeCheckoutSessionId ?? null,
        }
      : null,
  };
}

export async function saveAdminInvoice(
  id: string,
  body: AdminInvoicePayload,
  store: AdminInvoiceStore = defaultAdminInvoiceStore(),
): Promise<SaveAdminInvoiceResult> {
  const job = await store.findJob(id);
  if (!job) return { ok: false, status: 404, error: "Job not found." };

  const existing = await store.findInvoice(job.id);
  if (!existing) return { ok: false, status: 404, error: "This job does not have an invoice yet." };

  const locked = invoiceLockedReason(existing);
  if (locked) return { ok: false, status: 400, error: locked };

  const parsed = validateInvoicePayload(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.message };

  const depositPaidCents = depositCreditCents(job.payments, existing.paymentId);
  const totals = totalsFromLines(parsed.lines, depositPaidCents);
  const publish = existing.status === "SENT";
  const persistInput: PersistInvoiceInput & { jobStatus: string; eventNote: string } = {
    booking: { id: job.id, customerId: job.customerId },
    existing,
    contractorId: job.contractorId,
    lines: parsed.lines,
    totals,
    note: parsed.note,
    publish,
    bookingPayments: job.payments,
    jobStatus: job.status,
    eventNote: `Invoice ${existing.publicId} updated by admin — customer owes TOD ${formatUsd(totals.amountDueCents)}`,
  };
  const invoice = await store.persist(persistInput);
  if (invoice.status === "PAID") {
    await ensureContractorPayoutForPaidInvoice(invoice.id);
  }
  const surfaces: InvoiceRevalidateSurfaces = {
    jobId: job.id,
    jobPublicId: job.publicId,
    customerId: job.customerId,
    statusToken: job.token ?? null,
  };
  return { ok: true, invoice, publicInvoice: publicAdminInvoice(invoice), surfaces };
}

async function writeAdminInvoice(
  input: PersistInvoiceInput & { jobStatus: string; eventNote: string },
) {
  return prisma.$transaction(async (tx) => {
    const saved = await persistInvoiceEdits(tx, input);
    await tx.statusEvent.create({
      data: {
        bookingId: input.booking.id,
        status: input.jobStatus,
        note: input.eventNote,
      },
    });
    return saved;
  });
}
