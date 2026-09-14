"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function BookRetryPage() {
  return (
    <Suspense fallback={<p className="px-4 py-12 text-sm text-muted">Loading checkout…</p>}>
      <RetryInner />
    </Suspense>
  );
}

function RetryInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/bookings/${encodeURIComponent(token)}/checkout`, { method: "POST" });
    const payload = (await response.json()) as { error?: string; checkoutUrl?: string };
    if (payload.checkoutUrl) {
      window.location.assign(payload.checkoutUrl);
      return;
    }
    setError(payload.error || "Could not restart TOD Checkout.");
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="stamp text-xs text-ember">Checkout canceled</p>
      <h1 className="mt-2 font-display text-4xl text-navy">Pay Trades on Demand to hold the job</h1>
      <p className="mt-3 text-sm text-muted">
        The contractor is not charged and is not the merchant of record. Payments are processed by
        Trademark Walls for Trades on Demand.
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={retry}
          disabled={!token || busy}
          className="h-12 rounded-full bg-ember px-6 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Opening Checkout…" : "Retry Stripe Checkout"}
        </button>
        {token ? (
          <Link href={`/status/${token}`} className="inline-flex h-12 items-center justify-center text-sm font-semibold text-navy">
            View job without paying yet
          </Link>
        ) : null}
      </div>
    </div>
  );
}
