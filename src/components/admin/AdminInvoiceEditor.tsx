"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceBreakdown } from "@/components/invoice/InvoiceBreakdown";
import { parseResponseJson } from "@/lib/http";
import {
  invoiceIsLocked,
  linesToFormState,
  parseDiscountRow,
  parseLaborRow,
  parseMaterialRow,
  totalsFromLines,
  type InvoiceLineDraft,
} from "@/lib/invoice";
import { centsToInput, formatUsd } from "@/lib/money";

type LaborRow = { description: string; hours: string; rate: string };
type MaterialRow = { description: string; cost: string };
type DiscountRow = { description: string; amount: string };

const emptyLabor = (rate: string): LaborRow => ({ description: "Labor", hours: "", rate });
const emptyMaterial = (): MaterialRow => ({ description: "", cost: "" });
const emptyDiscount = (): DiscountRow => ({ description: "", amount: "" });

export type AdminInvoiceEditorInvoice = {
  publicId: string;
  status: string;
  note: string | null;
  laborCents: number;
  materialsCents: number;
  subtotalCents: number;
  customerSubtotalCents?: number | null;
  markupCents?: number | null;
  depositPaidCents: number;
  amountDueCents: number;
  lines: InvoiceLineDraft[];
};

export function AdminInvoiceEditor({
  jobId,
  depositPaidCents,
  invoice,
  onCancel,
  onSaved,
}: {
  jobId: string;
  depositPaidCents: number;
  invoice: AdminInvoiceEditorInvoice;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const initial = linesToFormState(invoice.lines);
  const defaultRate = centsToInput(invoice.lines.find((line) => line.kind === "LABOR")?.unitCents);
  const [labor, setLabor] = useState<LaborRow[]>(initial.labor);
  const [materials, setMaterials] = useState<MaterialRow[]>(initial.materials);
  const [discounts, setDiscounts] = useState<DiscountRow[]>(initial.discounts);
  const [note, setNote] = useState(invoice.note ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = invoiceIsLocked(invoice.status);

  const preview = useMemo(() => {
    const lines: InvoiceLineDraft[] = [];
    for (const row of labor) {
      const parsed = parseLaborRow(row);
      if (parsed.ok && "line" in parsed) lines.push(parsed.line);
    }
    for (const row of materials) {
      const parsed = parseMaterialRow(row);
      if (parsed.ok && "line" in parsed) lines.push(parsed.line);
    }
    for (const row of discounts) {
      const parsed = parseDiscountRow(row);
      if (parsed.ok && "line" in parsed) lines.push(parsed.line);
    }
    return { lines, totals: totalsFromLines(lines, depositPaidCents) };
  }, [labor, materials, discounts, depositPaidCents]);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/bookings/${encodeURIComponent(jobId)}/invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labor, materials, discounts, note: note.trim() || undefined }),
    });
    const payload = await parseResponseJson<{ error?: string }>(response);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not save the invoice.");
      return;
    }
    setMessage("Invoice saved. The customer balance and pay link use the marked-up amount due.");
    router.refresh();
    onSaved?.();
  }

  if (locked) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-3 text-sm text-navy">
          This invoice is paid to TOD. Line amounts cannot be changed after Stripe has captured the
          balance.
        </p>
        <InvoiceBreakdown
          publicId={invoice.publicId}
          status={invoice.status}
          lines={invoice.lines}
          laborCents={invoice.laborCents}
          materialsCents={invoice.materialsCents}
          subtotalCents={invoice.subtotalCents}
          customerSubtotalCents={invoice.customerSubtotalCents}
          markupCents={invoice.markupCents}
          depositPaidCents={invoice.depositPaidCents}
          amountDueCents={invoice.amountDueCents}
          note={invoice.note}
          variant="admin"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Edit shop line items and optional shop discounts. TOD adds a 20% platform fee on the shop
        subtotal after discounts; the customer Checkout amount is that marked-up total minus paid
        deposits. An open Stripe session is dropped if the customer amount due changes.
      </p>
      {depositPaidCents > 0 ? (
        <p className="text-sm text-navy">Deposit already paid to TOD: {formatUsd(depositPaidCents)}</p>
      ) : (
        <p className="text-sm text-muted">No paid TOD deposit to credit yet.</p>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Labor</p>
        {labor.map((row, index) => (
          <div key={`labor-${index}`} className="grid gap-2 sm:grid-cols-[1fr_5.5rem_6.5rem_auto]">
            <input
              value={row.description}
              onChange={(event) => updateLabor(index, { description: event.target.value })}
              placeholder="Labor"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            />
            <input
              value={row.hours}
              onChange={(event) => updateLabor(index, { hours: event.target.value })}
              inputMode="decimal"
              placeholder="Hours"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            />
            <input
              value={row.rate}
              onChange={(event) => updateLabor(index, { rate: event.target.value })}
              inputMode="decimal"
              placeholder="$/hr"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setLabor((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
              disabled={labor.length === 1}
              className="h-11 text-sm font-semibold text-muted disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLabor((rows) => [...rows, emptyLabor(defaultRate)])}
          className="text-sm font-semibold text-ember"
        >
          + Labor line
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Materials</p>
        {materials.map((row, index) => (
          <div key={`material-${index}`} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <input
              value={row.description}
              onChange={(event) => updateMaterial(index, { description: event.target.value })}
              placeholder="Part or material"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            />
            <input
              value={row.cost}
              onChange={(event) => updateMaterial(index, { cost: event.target.value })}
              inputMode="decimal"
              placeholder="Cost"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setMaterials((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
              }
              disabled={materials.length === 1}
              className="h-11 text-sm font-semibold text-muted disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setMaterials((rows) => [...rows, emptyMaterial()])}
          className="text-sm font-semibold text-ember"
        >
          + Material
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-ember/25 bg-ember/5 px-3 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ember">Shop discount</p>
          <p className="mt-1 text-xs text-muted">
            Off the shop subtotal before the 20% TOD markup. Enter the amount the shop is taking
            off, not the customer price.
          </p>
        </div>
        {discounts.map((row, index) => (
          <div key={`discount-${index}`} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <input
              value={row.description}
              onChange={(event) => updateDiscount(index, { description: event.target.value })}
              placeholder="Goodwill, correction, coupon…"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            />
            <input
              value={row.amount}
              onChange={(event) => updateDiscount(index, { amount: event.target.value })}
              inputMode="decimal"
              placeholder="Amount"
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
              aria-label="Shop discount amount"
            />
            <button
              type="button"
              onClick={() =>
                setDiscounts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
              }
              disabled={discounts.length === 1}
              className="h-11 text-sm font-semibold text-muted disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDiscounts((rows) => [...rows, emptyDiscount()])}
          className="text-sm font-semibold text-ember"
        >
          + Discount
        </button>
      </div>

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note for the customer"
        className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
      />

      <div className="rounded-xl border border-line/70 bg-cream/50 px-3 py-3">
        <InvoiceBreakdown
          status={invoice.status}
          lines={preview.lines}
          laborCents={preview.totals.laborCents}
          materialsCents={preview.totals.materialsCents}
          subtotalCents={preview.totals.subtotalCents}
          customerSubtotalCents={preview.totals.customerSubtotalCents}
          markupCents={preview.totals.markupCents}
          depositPaidCents={preview.totals.depositPaidCents}
          amountDueCents={preview.totals.amountDueCents}
          variant="admin"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save invoice"}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="h-11 rounded-full border border-line px-5 text-sm font-semibold text-navy disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </div>
  );

  function updateLabor(index: number, patch: Partial<LaborRow>) {
    setLabor((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateMaterial(index: number, patch: Partial<MaterialRow>) {
    setMaterials((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function updateDiscount(index: number, patch: Partial<DiscountRow>) {
    setDiscounts((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }
}
