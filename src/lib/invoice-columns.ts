import { isSchemaMismatchError } from "./api-errors";
import { prisma } from "./prisma";

export function isMissingInvoiceModel(error: unknown): boolean {
  if (!isSchemaMismatchError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\bInvoice(Line)?\b/i.test(message);
}

/** Present in Prisma; Neon may not have them until `npm run db:migrate`. */
export const INVOICE_MARKUP_OMIT = {
  customerSubtotalCents: true,
  markupCents: true,
} as const;

export function isMissingInvoiceMarkupColumn(error: unknown): boolean {
  if (!isSchemaMismatchError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /customerSubtotalCents|Invoice\.markupCents|\bmarkupCents\b/i.test(message);
}

export type BookingInvoice = Awaited<ReturnType<typeof loadBookingInvoice>>;

export async function loadBookingInvoice(bookingId: string) {
  try {
    return await prisma.invoice.findUnique({
      where: { bookingId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        payment: true,
      },
    });
  } catch (error) {
    if (isMissingInvoiceMarkupColumn(error)) {
      const invoice = await prisma.invoice.findUnique({
        where: { bookingId },
        omit: INVOICE_MARKUP_OMIT,
        include: {
          lines: { orderBy: { sortOrder: "asc" } },
          payment: true,
        },
      });
      return invoice ? { ...invoice, customerSubtotalCents: 0, markupCents: 0 } : null;
    }
    if (isMissingInvoiceModel(error)) return null;
    throw error;
  }
}
