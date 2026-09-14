"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password, confirm }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not save that password.");
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    setMessage(hasPassword ? "Password updated." : "Password saved. Use it the next time you sign in.");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-paper p-5">
      <h3 className="font-display text-xl text-navy">{hasPassword ? "Change password" : "Set a password"}</h3>
      <p className="text-sm text-muted">
        {hasPassword
          ? "Rotates your signed-in session. At least 10 characters."
          : "Protect this profile so only you can open jobs and pay TOD."}
      </p>
      {hasPassword ? (
        <label className="block text-sm">
          <span className="font-medium text-navy">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-2 h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium text-navy">New password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Confirm password</span>
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={pending}
        className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream disabled:opacity-60"
      >
        {pending ? "Saving…" : hasPassword ? "Update password" : "Save password"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}
    </div>
  );
}
