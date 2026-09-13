"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ContractorLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/contractor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not sign in.");
      return;
    }
    router.push("/contractor");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="stamp text-xs text-ember">Partner app</p>
      <h1 className="mt-2 font-display text-3xl text-navy">Contractor sign in</h1>
      <p className="mt-3 text-sm text-muted">
        Approved licensed partners only. Use the email and phone from your application. Customers
        pay Trades on Demand — do not collect payment on site.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
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
          <span className="font-medium text-navy">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream">
          Open jobs
        </button>
      </form>
    </div>
  );
}
