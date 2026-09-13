"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONTRACTOR_JOB_STATUSES, contractorStatusActionLabel } from "@/lib/contractor-app";
import { parseResponseJson } from "@/lib/http";

export function ContractorJobActions({
  id,
  status,
  assigned,
  smsStatus,
}: {
  id: string;
  status: string;
  assigned: boolean;
  smsStatus?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [eta, setEta] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(assigned);

  async function send(body: { status?: string; note?: string; claim?: boolean; eta?: string }) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/contractor/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        note: note.trim() || undefined,
        eta: body.eta?.trim() || undefined,
      }),
    });
    const payload = await parseResponseJson<{ error?: string; sms?: { status?: string } }>(response);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not update job.");
      return;
    }
    if (body.claim) setAccepted(true);
    setNote("");
    if (body.eta) {
      const sms = payload.sms?.status;
      if (sms === "SENT") setMessage("Client texted with your arrival note.");
      else if (sms === "SKIPPED") {
        setMessage("Arrival note saved. SMS skipped — Twilio is not configured on the server.");
      } else if (sms === "FAILED") setMessage("Arrival note saved, but the text failed. Call the KC desk.");
      else setMessage("Arrival note saved.");
      setEta("");
    } else {
      setMessage(body.claim ? "Job is yours. Tell the client when you can get there." : "Updated.");
    }
    router.refresh();
  }

  const showEta = accepted;

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

      {showEta ? (
        <div className="space-y-2 rounded-2xl border border-line bg-cream/40 p-3">
          <label className="block text-sm font-medium text-navy">
            Text the client when you can get there
          </label>
          <textarea
            value={eta}
            onChange={(event) => setEta(event.target.value)}
            rows={3}
            maxLength={240}
            placeholder="I can be there in about 45 minutes."
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={saving || eta.trim().length < 8}
            onClick={() => send({ eta })}
            className="h-11 w-full rounded-full bg-ember text-sm font-semibold text-white disabled:opacity-60"
          >
            {smsStatus === "SENT" ? "Send another arrival text" : "Send arrival text"}
          </button>
          {smsStatus ? (
            <p className="text-xs text-muted">
              Last SMS: {smsStatus === "SENT" ? "sent" : smsStatus === "SKIPPED" ? "skipped (no Twilio)" : smsStatus.toLowerCase()}
            </p>
          ) : null}
        </div>
      ) : null}

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
