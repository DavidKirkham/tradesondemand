"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminContractorOption } from "@/lib/admin-assign";

export function AdminAssignContractor({
  bookingId,
  trade,
  currentContractorId,
  currentContractorName,
  contractors,
}: {
  bookingId: string;
  trade: string;
  currentContractorId: string | null;
  currentContractorName: string | null;
  contractors: AdminContractorOption[];
}) {
  const router = useRouter();
  const options = contractors.filter((row) => !trade || row.trades.includes(trade));
  const [contractorId, setContractorId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = options.find((row) => row.id === contractorId);
  const isReassign = Boolean(currentContractorId && selected && selected.id !== currentContractorId);

  async function assign() {
    if (!selected) {
      setMessage("Pick an approved subcontractor.");
      return;
    }
    if (isReassign && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/bookings/${bookingId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractorId: selected.id }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not assign that job.");
      return;
    }
    setConfirming(false);
    setContractorId("");
    setMessage(`Assigned to ${selected.businessName}.`);
    router.refresh();
  }

  if (options.length === 0) {
    return <p className="text-xs text-muted">No approved subcontractors for this trade.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={contractorId}
          onChange={(event) => {
            setContractorId(event.target.value);
            setConfirming(false);
            setMessage("");
          }}
          className="h-10 min-w-[12rem] flex-1 rounded-lg border border-line bg-white px-2 text-sm"
        >
          <option value="">{currentContractorName ? "Reassign…" : "Assign subcontractor…"}</option>
          {options.map((row) => (
            <option key={row.id} value={row.id} disabled={row.id === currentContractorId}>
              {row.businessName}
              {row.id === currentContractorId ? " (current)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || !contractorId}
          onClick={() => void assign()}
          className="h-10 rounded-full bg-navy px-4 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? "Saving…" : confirming ? "Confirm reassign" : "Assign"}
        </button>
      </div>
      {confirming && selected && currentContractorName ? (
        <p className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-navy">
          Reassign this job from <strong>{currentContractorName}</strong> to{" "}
          <strong>{selected.businessName}</strong>? Confirm to push it to the new shop.
        </p>
      ) : null}
      {message ? <p className="text-xs text-navy">{message}</p> : null}
    </div>
  );
}
