"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError("That password does not match ADMIN_PASSWORD or OPS_PASSWORD.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="stamp text-xs text-ember">Internal</p>
      <h1 className="mt-2 font-display text-3xl text-navy">Admin</h1>
      <p className="mt-2 text-sm text-muted">
        Review and edit clients and subcontractors. Default local password is{" "}
        <code className="rounded bg-cream-2 px-1">dispatch</code> (
        <code className="rounded bg-cream-2 px-1">ADMIN_PASSWORD</code> or{" "}
        <code className="rounded bg-cream-2 px-1">OPS_PASSWORD</code>).
      </p>
      <form onSubmit={login} className="mt-6 space-y-3">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Admin password"
          autoComplete="current-password"
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream">
          Open admin
        </button>
      </form>
    </div>
  );
}
