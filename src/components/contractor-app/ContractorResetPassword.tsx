"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ContractorResetPassword({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/contractor/password/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirm }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not reset that password.");
      return;
    }
    router.push("/contractor");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="stamp text-xs text-ember">Partner app</p>
      <h1 className="mt-2 font-display text-3xl text-navy">Choose a new password</h1>
      <p className="mt-3 text-sm text-muted">
        This link is one-time and expires in 20 minutes. After you save, the old password and other
        signed-in devices stop working.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-navy">New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-navy">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
          />
        </label>
        <p className="text-xs text-muted">At least 10 characters. Do not reuse a customer or personal login.</p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
        >
          {pending ? "Working…" : "Save password and open jobs"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        Link expired?{" "}
        <Link href="/contractor/forgot" className="font-semibold text-ember">
          Request a new text
        </Link>
      </p>
    </div>
  );
}
