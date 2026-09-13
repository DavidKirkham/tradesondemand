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
  const locked = invoiceIsLocked(invoice.status);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#invoice") {
      setEditing(true);
    }
  }, []);

  function openEditor() {
    setEditing(true);
  }

  return (
    <section id="invoice" className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-navy">Invoice</h2>
          <p className="mt-1 text-sm text-muted">
            Click the customer balance to edit shop line items. Checkout charges the marked-up
            amount due (shop + 20%), not the shop subtotal.
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
            invoice={invoice}
            onCancel={locked ? undefined : () => setEditing(false)}
          />
        </div>
      ) : (
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
            amountDue={
              <button
                type="button"
                onClick={openEditor}
                className="font-semibold text-ember underline decoration-ember/40 underline-offset-2 hover:decoration-ember"
              >
                {formatUsd(invoice.amountDueCents)}
              </button>
            }
            note={invoice.note}
            variant="admin"
          />
        </div>
      )}
    </section>
  );
}
