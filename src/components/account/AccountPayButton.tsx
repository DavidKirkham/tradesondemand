"use client";

import { useState } from "react";

export function AccountPayButton({
  jobId,
  paymentId,
  label,
}: {
  jobId: string;
  paymentId: string;
  label: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/account/jobs/${encodeURIComponent(jobId)}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    const payload = (await response.json()) as { error?: string; checkoutUrl?: string };
    if (payload.checkoutUrl) {
      window.location.assign(payload.checkoutUrl);
      return;
    }
    setError(payload.error || "Could not open TOD Checkout.");
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        className="h-11 w-full rounded-full bg-ember px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Opening Checkout…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
