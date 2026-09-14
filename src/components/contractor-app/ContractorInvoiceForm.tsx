"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceBreakdown } from "@/components/invoice/InvoiceBreakdown";
import { parseResponseJson } from "@/lib/http";
import {
  invoiceIsLocked,
  linesToFormState,
  parseLaborRow,
  parseMaterialRow,
  preserveDiscountLines,
  totalsFromLines,
  type InvoiceLineDraft,
} from "@/lib/invoice";
import { centsToInput, formatUsd } from "@/lib/money";
import { describeInvoiceSms } from "@/lib/sms";

type LaborRow = { description: string; hours: string; rate: string };
type MaterialRow = { description: string; cost: string };

const emptyLabor = (rate: string): LaborRow => ({ description: "Labor", hours: "", rate });
const emptyMaterial = (): MaterialRow => ({ description: "", cost: "" });

export function ContractorInvoiceForm({
  jobId,
  defaultLaborRateCents,
  depositPaidCents,
  invoice,
}: {
  jobId: string;
  defaultLaborRateCents: number;
  depositPaidCents: number;
  invoice: {
    publicId: string;
    status: string;
    note: string | null;
    laborCents: number;
    materialsCents: number;
    subtotalCents: number;
    customerSubtotalCents?: number;
    markupCents?: number;
    depositPaidCents: number;
    amountDueCents: number;
    lines: InvoiceLineDraft[];
  } | null;
}) {
  const router = useRouter();
  const defaultRate = centsToInput(defaultLaborRateCents);
  const initial = invoice ? linesToFormState(invoice.lines) : null;
  const [labor, setLabor] = useState<LaborRow[]>(
    initial?.labor ?? [emptyLabor(defaultRate)],
  );
  const [materials, setMaterials] = useState<MaterialRow[]>(
    initial?.materials ?? [emptyMaterial()],
  );
  const [note, setNote] = useState(invoice?.note ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = invoice ? invoiceIsLocked(invoice.status) : false;

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
    const withDiscounts = preserveDiscountLines(lines, invoice?.lines ?? []);
    return { lines: withDiscounts, totals: totalsFromLines(withDiscounts, depositPaidCents) };
  }, [labor, materials, depositPaidCents, invoice?.lines]);

  async function submit(send: boolean) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/contractor/jobs/${encodeURIComponent(jobId)}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ send, labor, materials, note: note.trim() || undefined }),
    });
    const payload = await parseResponseJson<{
      error?: string;
      sms?: { status?: string; error?: string | null; persistSkipped?: boolean };
    }>(response);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not save the invoice.");
      return;
    }
    if (send) {
      setMessage(
        describeInvoiceSms({
          status: payload.sms?.status ?? "",
          error: payload.sms?.error,
          persistSkipped: payload.sms?.persistSkipped,
        }),
      );
    } else {
      setMessage("Draft saved. Send it when the customer should pay TOD.");
    }
    router.refresh();
  }

  if (locked && invoice) {
    return (
      <section className="rounded-2xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Invoice</h2>
        <div className="mt-3">
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
            variant="contractor"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Time & materials invoice
      </h2>
      <p className="mt-1 text-sm text-muted">
        Bill hours at your shop rate plus parts — enter what you earn, not the customer price.
        TOD adds a 20% platform fee when the customer pays. Paid deposits are credited before
        the balance.
      </p>
      {depositPaidCents > 0 ? (
        <p className="mt-2 text-sm text-navy">
          Deposit already paid to TOD: {formatUsd(depositPaidCents)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">No paid TOD deposit to credit yet.</p>
      )}

      <div className="mt-4 space-y-3">
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

      <div className="mt-5 space-y-3">
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

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note for the customer"
        className="mt-4 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
      />

      <div className="mt-4 rounded-xl border border-line/70 bg-cream/50 px-3 py-3">
        <InvoiceBreakdown
          status={invoice?.status ?? "DRAFT"}
          lines={preview.lines}
          laborCents={preview.totals.laborCents}
          materialsCents={preview.totals.materialsCents}
          subtotalCents={preview.totals.subtotalCents}
          customerSubtotalCents={preview.totals.customerSubtotalCents}
          markupCents={preview.totals.markupCents}
          depositPaidCents={preview.totals.depositPaidCents}
          amountDueCents={preview.totals.amountDueCents}
          variant="contractor"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(false)}
          className="h-11 rounded-full border border-navy text-sm font-semibold text-navy disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(true)}
          className="h-11 rounded-full bg-ember text-sm font-semibold text-white disabled:opacity-60"
        >
          {invoice?.status === "SENT" ? "Update and text customer" : "Send invoice"}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-navy">{message}</p> : null}
    </section>
  );

  function updateLabor(index: number, patch: Partial<LaborRow>) {
    setLabor((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateMaterial(index: number, patch: Partial<MaterialRow>) {
    setMaterials((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }
}
