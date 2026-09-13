"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AccountForgotForm() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/account/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not send a reset code.");
      return;
    }
    setMessage(payload.message || "If that profile exists, we texted a reset code.");
    setStep("reset");
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, code, password, confirm }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not reset that password.");
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="stamp text-xs text-ember">Customer portal</p>
      <h1 className="mt-2 font-display text-3xl text-navy">Reset password</h1>
      <p className="mt-3 text-sm text-muted">
        We text a 6-digit code to the phone on your profile. Email reset is not enabled yet. 555
        test numbers cannot receive SMS.
      </p>

      {step === "request" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-navy">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-navy">Phone on the booking</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
          >
            {pending ? "Sending…" : "Text me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="mt-6 space-y-3">
          {message ? <p className="rounded-xl bg-gold/20 px-3 py-2 text-sm text-navy">{message}</p> : null}
          <label className="block text-sm">
            <span className="font-medium text-navy">6-digit code</span>
            <input
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
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save password and open jobs"}
          </button>
          <button
            type="button"
            className="w-full text-sm font-semibold text-ember"
            onClick={() => {
              setStep("request");
              setError("");
            }}
          >
            Text a new code
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/account/login" className="font-semibold text-ember">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
