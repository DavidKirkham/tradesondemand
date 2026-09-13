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
      setError("Sign-in failed.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="stamp text-xs text-ember">Internal</p>
      <h1 className="mt-2 font-display text-3xl text-navy">Admin</h1>
      <p className="mt-2 text-sm text-muted">Review and edit clients and subcontractors.</p>
      <form onSubmit={login} className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-navy">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream">
          Open admin
        </button>
      </form>
    </div>
  );
}
