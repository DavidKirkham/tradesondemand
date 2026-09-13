import type { Prisma } from "@prisma/client";
import { createPaymentPublicId } from "./customer";
import {
  createInvoicePublicId,
  invoiceIsLocked,
  invoicePaymentNote,
  invoiceStatusAfterSend,
  persistableInvoiceMoney,
  type InvoiceLineDraft,
  type InvoiceTotals,
} from "./invoice";

export type InvoicePaymentRow = {
  id: string;
  status: string;
  amountCents: number;
};

export type ExistingInvoiceRow = {
  id: string;
  publicId: string;
  paymentId: string | null;
  sentAt: Date | null;
  paidAt: Date | null;
  status: string;
  payment: InvoicePaymentRow | null;
};

export type PersistInvoiceInput = {
  booking: { id: string; customerId: string | null };
  existing: ExistingInvoiceRow | null;
  contractorId: string | null;
  lines: InvoiceLineDraft[];
  totals: InvoiceTotals;
  note: string | null;
  publish: boolean;
  omitMarkupColumns?: boolean;
};

export type BalancePaymentPlan =
  | { kind: "none" }
  | { kind: "update"; paymentId: string; amountCents: number; note: string; clearStripe: boolean }
  | { kind: "create"; amountCents: number; note: string }
  | { kind: "delete"; paymentId: string };

export function invoiceLockedReason(existing: {
  status: string;
  payment?: { status: string } | null;
} | null): string | null {
  if (!existing) return null;
  if (invoiceIsLocked(existing.status)) return "This invoice is already paid to TOD.";
  if (existing.payment?.status === "PAID") return "This invoice is already paid to TOD.";
  return null;
}

export function planBalancePayment(input: {
  publish: boolean;
  amountDueCents: number;
  existingPayment: InvoicePaymentRow | null;
  publicId: string;
  depositPaidCents: number;
  subtotalCents: number;
  customerSubtotalCents?: number;
}): BalancePaymentPlan {
  if (!input.publish) return { kind: "none" };

  const note = invoicePaymentNote({
    publicId: input.publicId,
    depositPaidCents: input.depositPaidCents,
    subtotalCents: input.subtotalCents,
    customerSubtotalCents: input.customerSubtotalCents,
  });

  if (input.amountDueCents > 0) {
    if (input.existingPayment && input.existingPayment.status === "PENDING") {
      return {
        kind: "update",
        paymentId: input.existingPayment.id,
        amountCents: input.amountDueCents,
        note,
        clearStripe: input.existingPayment.amountCents !== input.amountDueCents,
      };
    }
    return { kind: "create", amountCents: input.amountDueCents, note };
  }

  if (input.existingPayment && input.existingPayment.status === "PENDING") {
    return { kind: "delete", paymentId: input.existingPayment.id };
  }

  return { kind: "none" };
}

export async function persistInvoiceEdits(tx: Prisma.TransactionClient, input: PersistInvoiceInput) {
  const { existing, totals, publish } = input;
  const money = persistableInvoiceMoney(totals, input.omitMarkupColumns);
  const nextStatus = publish ? invoiceStatusAfterSend(totals.amountDueCents) : "DRAFT";
  const now = new Date();

  const saved = existing
    ? await tx.invoice.update({
        where: { id: existing.id },
        data: {
          contractorId: input.contractorId,
          status: nextStatus,
          ...money,
          note: input.note,
          sentAt: publish ? (existing.sentAt ?? now) : existing.sentAt,
          paidAt: nextStatus === "PAID" ? (existing.paidAt ?? now) : null,
          lines: { deleteMany: {} },
        },
      })
    : await tx.invoice.create({
        data: {
          publicId: createInvoicePublicId(),
          bookingId: input.booking.id,
          contractorId: input.contractorId,
          status: nextStatus,
          ...money,
          note: input.note,
          sentAt: publish ? now : null,
          paidAt: nextStatus === "PAID" ? now : null,
        },
      });

  await tx.invoiceLine.createMany({
    data: input.lines.map((line, index) => ({
      invoiceId: saved.id,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unitCents: line.unitCents,
      amountCents: line.amountCents,
      sortOrder: index,
    })),
  });

  const plan = planBalancePayment({
    publish,
    amountDueCents: totals.amountDueCents,
    existingPayment: existing?.payment ?? null,
    publicId: saved.publicId,
    depositPaidCents: totals.depositPaidCents,
    subtotalCents: totals.subtotalCents,
    customerSubtotalCents: totals.customerSubtotalCents,
  });

  let paymentId = existing?.paymentId ?? null;
  if (plan.kind === "update") {
    await tx.payment.update({
      where: { id: plan.paymentId },
      data: {
        amountCents: plan.amountCents,
        note: plan.note,
        ...(plan.clearStripe ? { stripeCheckoutSessionId: null, stripePaymentIntentId: null } : {}),
      },
    });
    paymentId = plan.paymentId;
  } else if (plan.kind === "create") {
    const payment = await tx.payment.create({
      data: {
        publicId: createPaymentPublicId(),
        bookingId: input.booking.id,
        customerId: input.booking.customerId,
        amountCents: plan.amountCents,
        type: "BALANCE",
        status: "PENDING",
        note: plan.note,
      },
    });
    paymentId = payment.id;
  } else if (plan.kind === "delete") {
    await tx.invoice.update({
      where: { id: saved.id },
      data: { paymentId: null },
    });
    await tx.payment.delete({ where: { id: plan.paymentId } });
    paymentId = null;
  }

  return tx.invoice.update({
    where: { id: saved.id },
    data: { paymentId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, payment: true },
  });
}
