import { isSchemaMismatchError } from "./api-errors";
import { prisma } from "./prisma";

export function isMissingInvoiceModel(error: unknown): boolean {
  if (!isSchemaMismatchError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\bInvoice(Line)?\b/i.test(message);
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
    if (!isMissingInvoiceModel(error)) throw error;
    return null;
  }
}
