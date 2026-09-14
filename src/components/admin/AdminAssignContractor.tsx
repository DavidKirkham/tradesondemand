"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminContractorOption } from "@/lib/admin-assign";
import { parseResponseJson } from "@/lib/http";

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
  const matching = useMemo(
    () => contractors.filter((row) => !trade || row.trades.includes(trade)),
    [contractors, trade],
  );
  const otherApproved = useMemo(
    () => contractors.filter((row) => trade && !row.trades.includes(trade)),
    [contractors, trade],
  );
  const [contractorId, setContractorId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = matching.find((row) => row.id === contractorId);
  const isReassign = Boolean(currentContractorId && selected && selected.id !== currentContractorId);

  async function assign() {
    if (!selected) {
      setMessage("Pick an approved subcontractor for this trade.");
      return;
    }
    if (isReassign && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, contractorId: selected.id }),
    });
    const payload = await parseResponseJson<{ error?: string }>(response);
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

  if (contractors.length === 0) {
    return (
      <p className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-2 text-sm text-navy">
        No approved subcontractors yet.{" "}
        <Link href="/admin/contractors?status=PENDING" className="font-semibold text-ember">
          Approve a shop
        </Link>{" "}
        first, then assign this job.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
        Assign to approved subcontractor
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={contractorId}
          onChange={(event) => {
            setContractorId(event.target.value);
            setConfirming(false);
            setMessage("");
          }}
          className="h-11 min-w-[12rem] flex-1 rounded-lg border border-line bg-white px-2 text-sm"
        >
          <option value="">{currentContractorName ? "Reassign to another shop…" : "Pick a subcontractor…"}</option>
          {matching.map((row) => (
            <option key={row.id} value={row.id} disabled={row.id === currentContractorId}>
              {row.businessName}
              {row.id === currentContractorId ? " (current)" : ""}
            </option>
          ))}
          {otherApproved.length > 0 ? (
            <optgroup label="Approved — other trades (cannot assign)">
              {otherApproved.map((row) => (
                <option key={row.id} value="" disabled>
                  {row.businessName} ({row.trades.join(", ") || "no trade"})
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <button
          type="button"
          disabled={saving || !contractorId}
          onClick={() => void assign()}
          className="h-11 rounded-full bg-ember px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : confirming ? "Confirm reassign" : currentContractorName ? "Reassign" : "Assign job"}
        </button>
      </div>
      {matching.length === 0 ? (
        <p className="text-xs text-muted">
          None of the approved shops list this trade. Edit a shop&apos;s trades or approve another
          application.
        </p>
      ) : null}
      {confirming && selected && currentContractorName ? (
        <p className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-navy">
          Reassign this job from <strong>{currentContractorName}</strong> to{" "}
          <strong>{selected.businessName}</strong>? Confirm to push it to the new shop.
        </p>
      ) : null}
      {message ? <p className="text-sm font-medium text-navy">{message}</p> : null}
    </div>
  );
}
