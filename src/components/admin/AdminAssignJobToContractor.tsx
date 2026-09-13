"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { jobLabel, type AdminAssignableJob } from "@/lib/admin-assign";

export function AdminAssignJobToContractor({
  contractorId,
  contractorName,
  jobs,
}: {
  contractorId: string;
  contractorName: string;
  jobs: AdminAssignableJob[];
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = jobs.find((row) => row.id === bookingId);
  const isReassign = Boolean(selected?.contractorId && selected.contractorId !== contractorId);

  async function assign() {
    if (!selected) {
      setMessage("Pick a job to push to this shop.");
      return;
    }
    if (isReassign && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/bookings/${selected.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractorId }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not assign that job.");
      return;
    }
    setConfirming(false);
    setBookingId("");
    setMessage(`Assigned ${selected.publicId} to ${contractorName}.`);
    router.refresh();
  }

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-muted">
        No open jobs in this shop&apos;s trades to assign. Unassigned and reassignable tickets show
        here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={bookingId}
          onChange={(event) => {
            setBookingId(event.target.value);
            setConfirming(false);
            setMessage("");
          }}
          className="h-10 min-w-[14rem] flex-1 rounded-lg border border-line bg-white px-2 text-sm"
        >
          <option value="">Push a job to this shop…</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {jobLabel(job)}
              {job.contractorName ? ` · now ${job.contractorName}` : " · unassigned"}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || !bookingId}
          onClick={() => void assign()}
          className="h-10 rounded-full bg-navy px-4 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? "Saving…" : confirming ? "Confirm reassign" : "Assign to this shop"}
        </button>
      </div>
      {confirming && selected?.contractorName ? (
        <p className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-navy">
          This job is already with <strong>{selected.contractorName}</strong>. Confirm to reassign it
          to <strong>{contractorName}</strong>.
        </p>
      ) : null}
      {message ? <p className="text-xs text-navy">{message}</p> : null}
    </div>
  );
}
