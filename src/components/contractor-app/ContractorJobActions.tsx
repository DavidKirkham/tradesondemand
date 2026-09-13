"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONTRACTOR_JOB_STATUSES, contractorStatusActionLabel } from "@/lib/contractor-app";

export function ContractorJobActions({
  id,
  status,
  assigned,
}: {
  id: string;
  status: string;
  assigned: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function send(body: { status?: string; note?: string; claim?: boolean }) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/contractor/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, note: note.trim() || undefined }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not update job.");
      return;
    }
    setNote("");
    setMessage("Updated.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {!assigned ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => send({ claim: true })}
          className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
        >
          Accept this job
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {CONTRACTOR_JOB_STATUSES.filter((value) => value !== "DISPATCHED").map((value) => (
            <button
              key={value}
              type="button"
              disabled={saving || status === value}
              onClick={() => send({ status: value })}
              className={`h-11 rounded-full text-sm font-semibold disabled:opacity-50 ${
                status === value ? "bg-navy text-cream" : "border border-navy text-navy"
              }`}
            >
              {contractorStatusActionLabel(value)}
            </button>
          ))}
        </div>
      )}
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note"
        className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
      />
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </div>
  );
}
