"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AccountLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/account/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "We could not open that profile.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="stamp text-xs text-ember">Private</p>
      <h1 className="mt-2 font-display text-3xl text-navy">My profile</h1>
      <p className="mt-3 text-sm text-muted">
        Customer profiles are not public. Use the email and phone from a Kansas City booking. Your
        home address never appears in the contractor directory.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email on the booking"
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone on the booking"
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream">
          Open my jobs
        </button>
      </form>
    </div>
  );
}
