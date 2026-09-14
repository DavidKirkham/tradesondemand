"use client";

import { useState } from "react";

export function AdminContractorPassword({
  id,
  passwordSet,
  invitePath,
}: {
  id: string;
  passwordSet: boolean;
  invitePath: string | null;
}) {
  const [status, setStatus] = useState(passwordSet);
  const [link, setLink] = useState(invitePath ?? "");
  const [tempPassword, setTempPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function post(body: { action: "reset" | "set"; password?: string }) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/contractors/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: string;
      passwordSet?: boolean;
      invitePath?: string;
    };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not update password access.");
      return;
    }
    setStatus(Boolean(payload.passwordSet));
    if (payload.invitePath) setLink(payload.invitePath);
    if (body.action === "reset") {
      setMessage("Password cleared. Send the set-password link below. It does not stay a login bypass.");
    } else {
      setTempPassword("");
      setLink("");
      setMessage("Temporary password saved. Tell the shop to sign in at /contractor and change it.");
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-display text-2xl text-navy">Portal password</h2>
      <p className="text-sm text-muted">
        {status
          ? "This shop has a password. They can reset it from /contractor → Forgot password (SMS to the application phone). Magic links no longer open the app by themselves."
          : "No password yet. They set one with the invite link, or with the email and phone on the application."}
      </p>
      {link && !status ? (
        <p className="break-all rounded-xl bg-cream px-3 py-2 font-mono text-xs text-navy">{link}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void post({ action: "reset" })}
          className="h-10 rounded-full bg-navy px-4 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {saving ? "Working…" : "Issue set-password link"}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          value={tempPassword}
          onChange={(event) => setTempPassword(event.target.value)}
          placeholder="Optional: set a temporary password (10+ chars)"
          className="h-10 rounded-xl border border-line bg-white px-3 text-sm"
        />
        <button
          type="button"
          disabled={saving || tempPassword.length < 10}
          onClick={() => void post({ action: "set", password: tempPassword })}
          className="h-10 rounded-full border border-navy px-4 text-sm font-semibold text-navy disabled:opacity-60"
        >
          Set password
        </button>
      </div>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </section>
  );
}
