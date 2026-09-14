"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseResponseJson } from "@/lib/http";

export function ContractorConnectOnboard({
  status,
}: {
  status: "needs_onboarding" | "pending_review" | "ready";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"onboard" | "dashboard" | null>(null);
  const [error, setError] = useState("");

  async function start(action: "onboard" | "dashboard") {
    setBusy(action);
    setError("");
    const response = await fetch("/api/contractor/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await parseResponseJson<{ url?: string; error?: string }>(response);
    setBusy(null);
    if (!response.ok || !payload.url) {
      setError(payload.error || "Could not open Stripe. Try again.");
      router.refresh();
      return;
    }
    window.location.assign(payload.url);
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <h2 className="font-display text-xl text-navy">Get paid</h2>
      <p className="mt-1 text-sm text-muted">
        Open Stripe Express to add your bank details. TOD transfers your shop amount after the
        customer pays the invoice — the 20% markup stays with Trades on Demand.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status !== "ready" ? (
          <button
            type="button"
            onClick={() => void start("onboard")}
            disabled={busy !== null}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
          >
            {busy === "onboard"
              ? "Opening Stripe…"
              : status === "pending_review"
                ? "Finish Stripe setup"
                : "Set up Stripe payouts"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start("dashboard")}
            disabled={busy !== null}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60"
          >
            {busy === "dashboard" ? "Opening…" : "Open Stripe Express"}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
