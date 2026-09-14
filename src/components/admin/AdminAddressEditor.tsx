"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminAddressEditor({
  bookingId,
  publicId,
  street,
  city,
  state,
  zip,
}: {
  bookingId: string;
  publicId: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ street, city, state, zip });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not save address.");
      return;
    }
    setMessage("Address saved.");
    router.refresh();
  }

  return (
    <article className="space-y-2 rounded-xl border border-line bg-white p-4">
      <p className="font-mono text-xs text-muted">{publicId}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={draft.street}
          onChange={(event) => setDraft((current) => ({ ...current, street: event.target.value }))}
          placeholder="Street"
          className="h-10 rounded-lg border border-line px-3 text-sm md:col-span-2"
        />
        <input
          value={draft.city}
          onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
          placeholder="City"
          className="h-10 rounded-lg border border-line px-3 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.state}
            onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))}
            placeholder="MO or KS"
            className="h-10 rounded-lg border border-line px-3 text-sm"
          />
          <input
            value={draft.zip}
            onChange={(event) => setDraft((current) => ({ ...current, zip: event.target.value }))}
            placeholder="ZIP"
            className="h-10 rounded-lg border border-line px-3 text-sm"
          />
        </div>
      </div>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-9 rounded-full border border-navy px-4 text-xs font-semibold text-navy disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save address"}
      </button>
    </article>
  );
}
