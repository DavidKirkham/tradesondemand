"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseResponseJson } from "@/lib/http";
import { formatUsd } from "@/lib/money";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";

type BlockingPayment = {
  id: string;
  publicId: string;
  status: string;
  type: string;
  amountCents: number;
  stripeCheckoutSessionId: string | null;
};

export function AdminJobDelete({
  id,
  publicId,
  blockingPayments,
  cascadePaymentCount,
}: {
  id: string;
  publicId: string;
  blockingPayments: BlockingPayment[];
  cascadePaymentCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const blocked = blockingPayments.length > 0;
  const idMatches = confirm.trim().toLowerCase() === publicId.trim().toLowerCase();

  async function remove() {
    if (blocked || !idMatches) return;
    setDeleting(true);
    setMessage("");
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const payload = await parseResponseJson<{ error?: string; publicId?: string }>(response);
    setDeleting(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not delete job.");
      return;
    }
    const label = payload.publicId || publicId;
    router.push(`/admin/jobs?deleted=${encodeURIComponent(label)}`);
    router.refresh();
  }

  return (
    <section id="delete" className="space-y-3 rounded-2xl border border-danger/30 bg-paper p-5">
      <h2 className="font-display text-2xl text-navy">Delete job</h2>
      <p className="text-sm text-muted">
        Permanently removes this ticket, its status history, and client SMS fields. Pending invoices
        without an open Stripe checkout, and refunded invoices, are removed with the job. Paid
        invoices and open Stripe checkouts stay on the books — refund or wait first.
      </p>
      {cascadePaymentCount > 0 && !blocked ? (
        <p className="text-sm text-muted">
          {cascadePaymentCount} pending or refunded {cascadePaymentCount === 1 ? "invoice" : "invoices"}{" "}
          will be removed with this job.
        </p>
      ) : null}

      {blocked ? (
        <div className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-3 text-sm text-navy">
          <p className="font-semibold">
            {blockingPayments.length === 1
              ? "1 paid invoice or open Stripe checkout"
              : `${blockingPayments.length} paid invoices or open Stripe checkouts`}{" "}
            still on this job. Refund paid items or let the session expire before deleting.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockingPayments.map((payment) => (
              <li key={payment.id}>
                <span className="font-semibold">{payment.publicId}</span>
                {" · "}
                {formatUsd(payment.amountCents)} · {paymentTypeLabel(payment.type)} ·{" "}
                {paymentStatusLabel(payment.status)}
                {payment.stripeCheckoutSessionId && payment.status === "PENDING"
                  ? " · open checkout"
                  : null}
              </li>
            ))}
          </ul>
        </div>
      ) : open ? (
        <div className="space-y-3">
          <p className="text-sm text-navy">
            Type <span className="font-semibold">{publicId}</span> to confirm. This cannot be undone.
          </p>
          <label className="block text-sm">
            <span className="font-medium text-navy">Job ID</span>
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting || !idMatches}
              className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setMessage("");
              }}
              disabled={deleting}
              className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-navy disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white"
        >
          Delete job
        </button>
      )}
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </section>
  );
}
