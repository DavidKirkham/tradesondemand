"use client";

import { useState } from "react";

export function ContractorPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/contractor/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password, confirm }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not change password.");
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    setMessage("Password updated. Stay signed in on this device.");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-paper p-4">
      <h2 className="font-display text-xl text-navy">Password</h2>
      <p className="text-sm text-muted">
        Change the password you use at /contractor. Locked out? Use Forgot password on the sign-in
        page, or ask dispatch to issue a set-password link.
      </p>
      <label className="block text-sm">
        <span className="font-medium text-navy">Current password</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">New password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Confirm new password</span>
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-navy">{message}</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="h-11 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
      >
        {saving ? "Saving…" : "Update password"}
      </button>
    </div>
  );
}
