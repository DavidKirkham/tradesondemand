"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContractorSmsForm } from "@/components/contractor-app/ContractorSmsForm";
import { CONTRACTOR_JOB_STATUSES, contractorStatusActionLabel } from "@/lib/contractor-app";
import { parseResponseJson } from "@/lib/http";

export function ContractorJobActions({
  id,
  status,
  assigned,
  closed,
  smsStatus,
}: {
  id: string;
  status: string;
  assigned: boolean;
  closed?: boolean;
  smsStatus?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(assigned);

  async function send(body: { status?: string; note?: string; claim?: boolean }) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/contractor/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        note: note.trim() || undefined,
      }),
    });
    const payload = await parseResponseJson<{ error?: string }>(response);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not update job.");
      return;
    }
    if (body.claim) setAccepted(true);
    setNote("");
    setMessage(body.claim ? "Job is yours. Tell the client when you can get there." : "Updated.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {!accepted ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => send({ claim: true })}
          className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
        >
          Accept this job
        </button>
      ) : closed ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          This job is closed. You can still text the customer from here or SMS.
        </p>
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

      {accepted ? <ContractorSmsForm id={id} smsStatus={smsStatus} kind="eta" /> : null}

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional internal note"
        className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
      />
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </div>
  );
}
