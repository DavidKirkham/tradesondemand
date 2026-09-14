"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CallButton } from "@/components/CallButton";

export default function StatusLookupPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) {
      setError("Enter a job ID (TOD-…) or the status token from your confirmation.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/status/${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !payload.token) {
        setError(payload.error || "We couldn't find that ticket.");
        return;
      }
      router.push(`/status/${payload.token}`);
    } catch {
      setError("Lookup failed. Call dispatch if this is urgent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="stamp text-xs text-ember">Job status</p>
      <h1 className="mt-2 font-display text-4xl text-navy">Track a KC job</h1>
      <p className="mt-3 text-muted">
        Use the private link from your confirmation, or paste the TOD job ID here.
      </p>
      <form onSubmit={lookup} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-navy">Job ID or status token</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="TOD-A1B2C3"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-ember/30 focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
        >
          {loading ? "Looking up…" : "View status"}
        </button>
      </form>
      <div className="mt-6">
        <CallButton variant="ghost" />
      </div>
    </div>
  );
}
