"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountEditor({
  name,
  email,
  phone,
  preferredContact,
}: {
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ name, phone, preferredContact });
  const [message, setMessage] = useState("");

  async function save() {
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "Could not save.");
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-paper p-5">
      <label className="block text-sm">
        <span className="font-medium text-navy">Email</span>
        <input
          value={email}
          readOnly
          className="mt-2 h-11 w-full rounded-xl border border-line bg-cream/60 px-3 text-muted"
        />
        <span className="mt-1 block text-xs text-muted">
          This is the email you sign in with. It is not public.
        </span>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Name</span>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          className="mt-2 h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Phone</span>
        <input
          value={draft.phone}
          onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
          className="mt-2 h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Preferred contact</span>
        <select
          value={draft.preferredContact}
          onChange={(event) =>
            setDraft((current) => ({ ...current, preferredContact: event.target.value }))
          }
          className="mt-2 h-11 w-full rounded-xl border border-line px-3"
        >
          <option value="PHONE">Phone</option>
          <option value="EMAIL">Email</option>
        </select>
      </label>
      <button type="button" onClick={save} className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream">
        Save profile
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
