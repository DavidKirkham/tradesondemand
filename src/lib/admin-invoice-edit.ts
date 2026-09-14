import { depositCreditCents, totalsFromLines, validateInvoicePayload } from "./invoice";
import { isMissingInvoiceMarkupColumn } from "./invoice-columns";
import {
  invoiceLockedReason,
  persistInvoiceEdits,
  type ExistingInvoiceRow,
  type PersistInvoiceInput,
} from "./invoice-persist";
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
  status: string;
  customerId: string | null;
  contractorId: string | null;
  payments: { id: string; amountCents: number; status: string }[];
};

export type PersistedAdminInvoice = Awaited<ReturnType<typeof persistInvoiceEdits>>;

export type AdminInvoiceStore = {
  findJob: (id: string) => Promise<AdminInvoiceJob | null>;
  findInvoice: (bookingId: string) => Promise<ExistingInvoiceRow | null>;
  persist: (
    input: PersistInvoiceInput & { jobStatus: string; eventNote: string },
  ) => Promise<PersistedAdminInvoice>;
};

export type SaveAdminInvoiceResult =
  | { ok: true; invoice: PersistedAdminInvoice }
  | { ok: false; status: 400 | 404; error: string };

export function defaultAdminInvoiceStore(): AdminInvoiceStore {
  return {
    async findJob(id) {
      return prisma.booking.findFirst({
        where: { OR: [{ id }, { publicId: id }] },
        select: {
          id: true,
          publicId: true,
          status: true,
          customerId: true,
          contractorId: true,
          payments: { select: { id: true, amountCents: true, status: true } },
        },
      });
    },
    async findInvoice(bookingId) {
      return prisma.invoice.findUnique({
        where: { bookingId },
        include: { payment: { select: { id: true, status: true, amountCents: true } } },
      });
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
  const invoice = await store.persist({
    booking: { id: job.id, customerId: job.customerId },
    existing,
    contractorId: job.contractorId,
    lines: parsed.lines,
    totals,
    note: parsed.note,
    publish,
    jobStatus: job.status,
    eventNote: `Invoice ${existing.publicId} updated by admin — customer owes TOD ${formatUsd(totals.amountDueCents)}`,
  });

  return { ok: true, invoice };
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
