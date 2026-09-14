"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseResponseJson } from "@/lib/http";

export function AdminPayoutTransfer({
  payoutId,
  canTransfer,
  label = "Transfer shop amount",
}: {
  payoutId: string;
  canTransfer: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function transfer() {
    if (!canTransfer) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/payouts/${encodeURIComponent(payoutId)}/transfer`, {
      method: "POST",
    });
    const payload = await parseResponseJson<{ error?: string }>(response);
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Transfer failed.");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void transfer()}
        disabled={!canTransfer || busy}
        className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-50"
      >
        {busy ? "Transferring…" : label}
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
