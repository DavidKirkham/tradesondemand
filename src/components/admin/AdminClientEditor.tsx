"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminClientEditor({
  id,
  name,
  email,
  phone,
  preferredContact,
}: {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ name, email, phone, preferredContact });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not save client.");
      return;
    }
    setMessage("Client saved.");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-display text-2xl text-navy">Contact</h2>
      <label className="block text-sm">
        <span className="font-medium text-navy">Name</span>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Email</span>
        <input
          type="email"
          value={draft.email}
          onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Phone</span>
        <input
          value={draft.phone}
          onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Preferred contact</span>
        <select
          value={draft.preferredContact}
          onChange={(event) =>
            setDraft((current) => ({ ...current, preferredContact: event.target.value }))
          }
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        >
          <option value="PHONE">Phone</option>
          <option value="EMAIL">Email</option>
        </select>
      </label>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save client"}
      </button>
    </div>
  );
}
