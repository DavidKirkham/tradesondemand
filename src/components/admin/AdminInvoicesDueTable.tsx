"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { applySavedInvoiceToDueRow, invoicesDueTotalCents, type AdminInvoiceDueRow } from "@/lib/admin-invoices-due";
import { invoiceStatusLabel } from "@/lib/invoice";
import { formatUsd } from "@/lib/money";
import { AdminInvoiceEditor, type AdminInvoiceEditorInvoice } from "./AdminInvoiceEditor";

export type AdminInvoicesDueTableRow = Omit<AdminInvoiceDueRow, "sentAt" | "createdAt">;

export function AdminInvoicesDueTable({ rows }: { rows: AdminInvoicesDueTableRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [savedByInvoiceId, setSavedByInvoiceId] = useState<Record<string, AdminInvoiceEditorInvoice>>(
    {},
  );
  const displayRows = rows.flatMap((row) => {
    const saved = savedByInvoiceId[row.invoiceId];
    if (!saved) return [row];
    const next = applySavedInvoiceToDueRow(row, saved);
    return next ? [next] : [];
  });
  const open = displayRows.find((row) => row.invoiceId === openId) ?? null;
  const totalCents = invoicesDueTotalCents(displayRows);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <p className="mt-6 text-sm font-semibold text-navy">
        {displayRows.length} {displayRows.length === 1 ? "invoice" : "invoices"} · customer owes{" "}
        {formatUsd(totalCents)}
      </p>
      {displayRows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          Nothing is owed to TOD right now.
        </p>
      ) : (
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Subcontractor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Customer owes</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.invoiceId}
                className="cursor-pointer border-b border-line/70 align-top last:border-0 hover:bg-cream/60"
                onClick={() => setOpenId(row.invoiceId)}
              >
                <td className="px-4 py-3">
                  <Link
                    href={row.jobHref}
                    onClick={(event) => event.stopPropagation()}
                    className="font-mono text-xs font-semibold text-ember hover:underline"
                  >
                    {row.jobPublicId}
                  </Link>
                  <p className="text-xs text-muted">{row.invoicePublicId}</p>
                </td>
                <td className="px-4 py-3">
                  {row.clientId ? (
                    <Link
                      href={`/admin/clients/${row.clientId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-semibold text-navy hover:underline"
                    >
                      {row.clientName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-navy">{row.clientName}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.contractorId && row.contractorName ? (
                    <Link
                      href={`/admin/contractors/${row.contractorId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="text-navy hover:underline"
                    >
                      {row.contractorName}
                    </Link>
                  ) : (
                    <span className="text-muted">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3">{invoiceStatusLabel(row.status)}</td>
                <td className="px-4 py-3 text-muted">{row.sentAtLabel}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenId(row.invoiceId);
                    }}
                    className="font-semibold text-ember hover:underline"
                  >
                    {formatUsd(row.amountDueCents)}
                  </button>
                  {row.hasMarkup ? (
                    <p className="mt-0.5 text-xs text-muted">
                      shop {formatUsd(row.shopSubtotalCents)}
                      {row.discountCents !== 0 ? ` · discount ${formatUsd(row.discountCents)}` : ""}
                      {" · "}
                      markup {formatUsd(row.markupCents)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted">Legacy invoice — customer amount</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenId(row.invoiceId);
                    }}
                    className="text-sm font-semibold text-ember hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {open ? (
        <InvoiceDueEditorDrawer
          row={open}
          onClose={() => setOpenId(null)}
          onSaved={(saved) => {
            setSavedByInvoiceId((current) => ({ ...current, [open.invoiceId]: saved }));
            setOpenId(null);
          }}
        />
      ) : null}
    </>
  );
}

function InvoiceDueEditorDrawer({
  row,
  onClose,
  onSaved,
}: {
  row: AdminInvoicesDueTableRow;
  onClose: () => void;
  onSaved: (invoice: AdminInvoiceEditorInvoice) => void;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close invoice editor"
        className="absolute inset-0 bg-navy/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-paper shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-paper px-5 py-4">
          <div>
            <p className="stamp text-xs text-ember">Invoice</p>
            <h2 id={titleId} className="font-display text-2xl text-navy">
              Edit {row.invoicePublicId}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {row.clientName} · {row.jobPublicId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 shrink-0 rounded-full border border-line px-4 text-sm font-semibold text-navy"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">
          <AdminInvoiceEditor
            key={row.invoiceId}
            jobId={row.editor.jobId}
            depositPaidCents={row.editor.depositPaidCents}
            invoice={row.editor.invoice}
            onCancel={onClose}
            onSaved={(saved) => {
              if (saved) onSaved(saved);
              else onClose();
            }}
          />
          <p className="mt-4 text-xs text-muted">
            Need the full job record?{" "}
            <Link href={row.jobHref} className="font-semibold text-ember hover:underline">
              Open {row.jobPublicId}
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
