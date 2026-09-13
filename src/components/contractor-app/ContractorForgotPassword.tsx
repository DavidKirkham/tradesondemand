"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Step = "request" | "confirm";

export function ContractorForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/contractor/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not start a password reset.");
      return;
    }
    setNotice(payload.message || "If that shop is approved, we sent a reset text.");
    setStep("confirm");
  }

  async function confirmReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/contractor/password/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code, password, confirm }),
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
      <h1 className="mt-2 font-display text-3xl text-navy">Reset password</h1>
      <p className="mt-3 text-sm text-muted">
        We text a one-time code to the phone on your approved application. Dispatch can still reset
        it from Admin if you cannot get a text.
      </p>
      {notice ? <p className="mt-3 rounded-xl bg-gold/20 px-3 py-2 text-sm text-navy">{notice}</p> : null}

      {step === "request" ? (
        <form onSubmit={requestReset} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-navy">Email, phone, or shop ID</span>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
              placeholder="morgan@shop.example or PRO-D71B72"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
          >
            {pending ? "Working…" : "Text a reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmReset} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-navy">6-digit code from your text</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm tracking-widest"
            />
          </label>
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
          <p className="text-xs text-muted">At least 10 characters. This signs you in and signs out other devices.</p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
          >
            {pending ? "Working…" : "Save password and open jobs"}
          </button>
        </form>
      )}

      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        <p>
          Remembered it?{" "}
          <Link href="/contractor" className="font-semibold text-ember">
            Sign in
          </Link>
        </p>
        <p>Or tap the reset link in the text if this device is not the shop phone.</p>
      </div>
    </div>
  );
}
