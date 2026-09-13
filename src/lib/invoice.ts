import { randomBytes } from "node:crypto";
import { formatUsd, parseUsdToCents } from "./money";
import { applyPlatformMarkupCents, platformMarkupCents } from "./pricing";

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_LINE_KINDS = ["LABOR", "MATERIAL"] as const;
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number];

export const MAX_INVOICE_LINES = 20;
export const MAX_INVOICE_HOURS = 200;
export const MAX_INVOICE_SUBTOTAL_CENTS = 5_000_000;

export type InvoiceLineDraft = {
  kind: InvoiceLineKind;
  description: string;
  quantity: string;
  unitCents: number;
  amountCents: number;
};

export type InvoiceLaborRowInput = {
  description?: string;
  hours?: string;
  rate?: string;
};

export type InvoiceMaterialRowInput = {
  description?: string;
  cost?: string;
};

export type InvoiceTotals = {
  laborHours: string | null;
  laborRateCents: number;
  laborCents: number;
  materialsCents: number;
  subtotalCents: number;
  customerSubtotalCents: number;
  markupCents: number;
  depositPaidCents: number;
  amountDueCents: number;
};

export type InvoiceMoneyFields = {
  laborCents: number;
  materialsCents: number;
  subtotalCents: number;
  customerSubtotalCents?: number | null;
  markupCents?: number | null;
  depositPaidCents: number;
  amountDueCents: number;
};

export function createInvoicePublicId(): string {
  return `INV-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function isInvoiceLineKind(value: string): value is InvoiceLineKind {
  return (INVOICE_LINE_KINDS as readonly string[]).includes(value);
}

export function invoiceStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Sent to customer";
    case "PAID":
      return "Paid to TOD";
    default:
      return status;
  }
}

export function customerCanSeeInvoice(status: string): boolean {
  return status === "SENT" || status === "PAID";
}

export function invoiceIsLocked(status: string): boolean {
  return status === "PAID";
}

export function parseHours(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const hours = Number(cleaned);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_INVOICE_HOURS) return null;
  return hours;
}

export function laborCentsFromHours(hours: number, rateCents: number): number {
  return Math.round(hours * rateCents);
}

export function formatHours(value: string | null | undefined): string {
  if (!value?.trim()) return "0";
  const hours = Number(value);
  if (!Number.isFinite(hours)) return value;
  return hours.toFixed(hours % 1 === 0 ? 0 : 2);
}

export function depositCreditCents(
  payments: { id?: string; amountCents: number; status: string }[],
  excludePaymentId?: string | null,
): number {
  let paid = 0;
  for (const payment of payments) {
    if (payment.status !== "PAID") continue;
    if (excludePaymentId && payment.id === excludePaymentId) continue;
    paid += payment.amountCents;
  }
  return paid;
}

export function totalsFromLines(
  lines: Pick<InvoiceLineDraft, "kind" | "amountCents" | "quantity" | "unitCents">[],
  depositPaidCents: number,
): InvoiceTotals {
  let laborCents = 0;
  let materialsCents = 0;
  let laborHours: string | null = null;
  let laborRateCents = 0;
  for (const line of lines) {
    if (line.kind === "LABOR") {
      laborCents += line.amountCents;
      if (laborHours === null) {
        laborHours = line.quantity;
        laborRateCents = line.unitCents;
      }
    } else {
      materialsCents += line.amountCents;
    }
  }
  const subtotalCents = laborCents + materialsCents;
  const customerSubtotalCents = applyPlatformMarkupCents(subtotalCents);
  const markupCents = platformMarkupCents(subtotalCents);
  return {
    laborHours,
    laborRateCents,
    laborCents,
    materialsCents,
    subtotalCents,
    customerSubtotalCents,
    markupCents,
    depositPaidCents,
    amountDueCents: Math.max(0, customerSubtotalCents - depositPaidCents),
  };
}

export function invoiceHasStoredMarkup(invoice: Pick<InvoiceMoneyFields, "customerSubtotalCents">): boolean {
  return (invoice.customerSubtotalCents ?? 0) > 0;
}

export function customerFacingInvoiceLines<T extends { unitCents: number; amountCents: number }>(
  lines: T[],
  applyMarkup: boolean,
): T[] {
  if (!applyMarkup) return lines;
  return lines.map((line) => ({
    ...line,
    unitCents: applyPlatformMarkupCents(line.unitCents),
    amountCents: applyPlatformMarkupCents(line.amountCents),
  }));
}

export function customerFacingInvoiceTotals(invoice: InvoiceMoneyFields): {
  laborCents: number;
  materialsCents: number;
  subtotalCents: number;
  markupCents: number;
  depositPaidCents: number;
  amountDueCents: number;
} {
  if (!invoiceHasStoredMarkup(invoice)) {
    return {
      laborCents: invoice.laborCents,
      materialsCents: invoice.materialsCents,
      subtotalCents: invoice.subtotalCents,
      markupCents: invoice.markupCents ?? 0,
      depositPaidCents: invoice.depositPaidCents,
      amountDueCents: invoice.amountDueCents,
    };
  }
  return {
    laborCents: applyPlatformMarkupCents(invoice.laborCents),
    materialsCents: applyPlatformMarkupCents(invoice.materialsCents),
    subtotalCents: invoice.customerSubtotalCents ?? applyPlatformMarkupCents(invoice.subtotalCents),
    markupCents: invoice.markupCents ?? platformMarkupCents(invoice.subtotalCents),
    depositPaidCents: invoice.depositPaidCents,
    amountDueCents: invoice.amountDueCents,
  };
}

export function persistableInvoiceMoney(totals: InvoiceTotals, omitMarkupColumns = false) {
  const money = {
    laborHours: totals.laborHours,
    laborRateCents: totals.laborRateCents,
    laborCents: totals.laborCents,
    materialsCents: totals.materialsCents,
    subtotalCents: totals.subtotalCents,
    depositPaidCents: totals.depositPaidCents,
    amountDueCents: totals.amountDueCents,
  };
  if (omitMarkupColumns) return money;
  return {
    ...money,
    customerSubtotalCents: totals.customerSubtotalCents,
    markupCents: totals.markupCents,
  };
}

export function parseLaborRow(
  input: InvoiceLaborRowInput,
): { ok: true; skip: true } | { ok: true; line: InvoiceLineDraft } | { ok: false; message: string } {
  const description = input.description?.trim() || "Labor";
  const hoursRaw = input.hours?.trim() ?? "";
  const rateRaw = input.rate?.trim() ?? "";
  if (!hoursRaw && !rateRaw) return { ok: true, skip: true };
  if (!hoursRaw || !rateRaw) {
    return { ok: false, message: "Enter both hours and an hourly rate for labor." };
  }
  const hours = parseHours(hoursRaw);
  if (!hours) return { ok: false, message: "Labor hours must be a number up to 200 (for example 1.5)." };
  const rateCents = parseUsdToCents(rateRaw);
  if (!rateCents) return { ok: false, message: "Enter a positive hourly rate for labor." };
  if (description.length > 120) return { ok: false, message: "Keep labor descriptions under 120 characters." };
  return {
    ok: true,
    line: {
      kind: "LABOR",
      description,
      quantity: hoursRaw,
      unitCents: rateCents,
      amountCents: laborCentsFromHours(hours, rateCents),
    },
  };
}

export function parseMaterialRow(
  input: InvoiceMaterialRowInput,
): { ok: true; skip: true } | { ok: true; line: InvoiceLineDraft } | { ok: false; message: string } {
  const description = input.description?.trim() ?? "";
  const costRaw = input.cost?.trim() ?? "";
  if (!description && !costRaw) return { ok: true, skip: true };
  if (!description) return { ok: false, message: "Add a description for each material line." };
  if (description.length > 120) return { ok: false, message: "Keep material descriptions under 120 characters." };
  const unitCents = parseUsdToCents(costRaw);
  if (!unitCents) return { ok: false, message: "Enter a positive material cost." };
  return {
    ok: true,
    line: {
      kind: "MATERIAL",
      description,
      quantity: "1",
      unitCents,
      amountCents: unitCents,
    },
  };
}

export function validateInvoicePayload(input: {
  labor?: InvoiceLaborRowInput[];
  materials?: InvoiceMaterialRowInput[];
  note?: string;
}): { ok: true; lines: InvoiceLineDraft[]; note: string | null } | { ok: false; message: string } {
  const laborRows = input.labor ?? [];
  const materialRows = input.materials ?? [];
  if (laborRows.length > MAX_INVOICE_LINES || materialRows.length > MAX_INVOICE_LINES) {
    return { ok: false, message: `Keep invoices to ${MAX_INVOICE_LINES} labor and ${MAX_INVOICE_LINES} material lines.` };
  }

  const lines: InvoiceLineDraft[] = [];
  for (const row of laborRows) {
    const parsed = parseLaborRow(row);
    if (!parsed.ok) return parsed;
    if ("line" in parsed) lines.push(parsed.line);
  }
  for (const row of materialRows) {
    const parsed = parseMaterialRow(row);
    if (!parsed.ok) return parsed;
    if ("line" in parsed) lines.push(parsed.line);
  }
  if (lines.length === 0) {
    return { ok: false, message: "Add labor hours or at least one material cost." };
  }

  const note = input.note?.trim() || null;
  if (note && note.length > 400) return { ok: false, message: "Keep the invoice note under 400 characters." };

  const subtotal = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (subtotal > MAX_INVOICE_SUBTOTAL_CENTS) {
    return { ok: false, message: `Invoice subtotal must be ${formatUsd(MAX_INVOICE_SUBTOTAL_CENTS)} or less.` };
  }

  return { ok: true, lines, note };
}

export function invoiceStatusAfterSend(amountDueCents: number): InvoiceStatus {
  return amountDueCents > 0 ? "SENT" : "PAID";
}

export function invoicePaymentNote(input: {
  publicId: string;
  depositPaidCents: number;
  subtotalCents: number;
  customerSubtotalCents?: number;
}): string {
  const billedCents = input.customerSubtotalCents ?? input.subtotalCents;
  const credit =
    input.depositPaidCents > 0
      ? ` Deposit already paid ${formatUsd(input.depositPaidCents)} credited against ${formatUsd(billedCents)}.`
      : "";
  return `Time & materials invoice ${input.publicId}.${credit} You pay Trades on Demand (Trademark Walls), not the contractor.`;
}

export function contractorCanInvoiceJob(status: string): boolean {
  return status !== "CANCELLED";
}

export function toInvoiceLineDrafts(
  lines: { kind: string; description: string; quantity: string; unitCents: number; amountCents: number }[],
): InvoiceLineDraft[] {
  return lines.flatMap((line) =>
    isInvoiceLineKind(line.kind)
      ? [
          {
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unitCents: line.unitCents,
            amountCents: line.amountCents,
          },
        ]
      : [],
  );
}

export function linesToFormState(lines: InvoiceLineDraft[]): {
  labor: { description: string; hours: string; rate: string }[];
  materials: { description: string; cost: string }[];
} {
  const labor = lines
    .filter((line) => line.kind === "LABOR")
    .map((line) => ({
      description: line.description,
      hours: line.quantity,
      rate: (line.unitCents / 100).toFixed(line.unitCents % 100 === 0 ? 0 : 2),
    }));
  const materials = lines
    .filter((line) => line.kind === "MATERIAL")
    .map((line) => ({
      description: line.description,
      cost: (line.unitCents / 100).toFixed(line.unitCents % 100 === 0 ? 0 : 2),
    }));
  return {
    labor: labor.length > 0 ? labor : [{ description: "Labor", hours: "", rate: "" }],
    materials: materials.length > 0 ? materials : [{ description: "", cost: "" }],
  };
}
