"use client";

import { useEffect, useState } from "react";
import { InvoiceBreakdown } from "@/components/invoice/InvoiceBreakdown";
import { invoiceIsLocked } from "@/lib/invoice";
import { formatUsd } from "@/lib/money";
import {
  AdminInvoiceEditor,
  type AdminInvoiceEditorInvoice,
} from "./AdminInvoiceEditor";

export function AdminInvoiceSection({
  jobId,
  depositPaidCents,
  invoice,
}: {
  jobId: string;
  depositPaidCents: number;
  invoice: AdminInvoiceEditorInvoice;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<AdminInvoiceEditorInvoice | null>(null);
  const display = saved ?? invoice;
  const locked = invoiceIsLocked(display.status);

  useEffect(() => {
    if (window.location.hash === "#invoice") {
      setEditing(true);
    }
  }, []);

  useEffect(() => {
    if (saved && invoice.amountDueCents === saved.amountDueCents && invoice.status === saved.status) {
      setSaved(null);
    }
  }, [invoice, saved]);

  function openEditor() {
    setEditing(true);
  }

  function handleSaved(next?: AdminInvoiceEditorInvoice) {
    if (next) setSaved(next);
    setEditing(false);
  }

  return (
    <section id="invoice" className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-navy">Invoice</h2>
          <p className="mt-1 text-sm text-muted">
            Click the customer balance to edit shop line items and shop discounts. Checkout charges
            the marked-up amount due (shop after discount + 20%), not the shop subtotal.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={openEditor}
            className="text-sm font-semibold text-ember hover:underline"
          >
            {locked ? "View paid invoice" : "Edit invoice"}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4">
          <AdminInvoiceEditor
            jobId={jobId}
            depositPaidCents={depositPaidCents}
            invoice={display}
            onCancel={locked ? undefined : () => setEditing(false)}
            onSaved={handleSaved}
          />
        </div>
      ) : (
        <div className="mt-3">
          <InvoiceBreakdown
            publicId={display.publicId}
            status={display.status}
            lines={display.lines}
            laborCents={display.laborCents}
            materialsCents={display.materialsCents}
            subtotalCents={display.subtotalCents}
            customerSubtotalCents={display.customerSubtotalCents}
            markupCents={display.markupCents}
            depositPaidCents={display.depositPaidCents}
            amountDueCents={display.amountDueCents}
            amountDue={
              <button
                type="button"
                onClick={openEditor}
                className="font-semibold text-ember underline decoration-ember/40 underline-offset-2 hover:decoration-ember"
              >
                {formatUsd(display.amountDueCents)}
              </button>
            }
            note={display.note}
            variant="admin"
          />
        </div>
      )}
    </section>
  );
}
