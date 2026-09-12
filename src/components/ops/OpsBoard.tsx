"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOOKING_STATUSES, statusLabel } from "@/lib/booking";
import { getTrade } from "@/lib/trades";

export type OpsBooking = {
  id: string;
  publicId: string;
  trade: string;
  urgency: string;
  city: string;
  state: string;
  zip: string;
  street: string;
  customerName: string;
  customerPhone: string;
  status: string;
  problem: string;
  createdAt: string;
};

export function OpsBoard({ initialBookings }: { initialBookings: OpsBooking[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function updateStatus(id: string, status: string) {
    const response = await fetch(`/api/ops/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note[id] || undefined }),
    });
    if (!response.ok) {
      setError("Could not update that ticket.");
      return;
    }
    setNote((current) => ({ ...current, [id]: "" }));
    router.refresh();
  }

  const visible = initialBookings.filter((row) => filter === "ALL" || row.status === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="stamp text-xs text-ember">Dispatch</p>
          <h1 className="font-display text-3xl text-navy">KC job board</h1>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-muted">Status</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-lg border border-line bg-white px-2"
          >
            <option value="ALL">All</option>
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {visible.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          No tickets in this filter. Complete a booking on /book to see it here.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {visible.map((row) => {
            const trade = getTrade(row.trade);
            return (
              <article
                key={row.id}
                className={`rounded-2xl border bg-paper p-5 ${
                  row.urgency === "emergency" ? "border-ember/40" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-muted">{row.publicId}</p>
                    <h2 className="font-display text-2xl text-navy">{trade?.name ?? row.trade}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {row.street}, {row.city}, {row.state} {row.zip}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className={`font-semibold ${row.urgency === "emergency" ? "text-ember" : "text-navy"}`}>
                      {row.urgency}
                    </p>
                    <p className="text-muted">{statusLabel(row.status)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-navy">{row.problem}</p>
                <p className="mt-2 text-xs text-muted">
                  {row.customerName} · {row.customerPhone} ·{" "}
                  {new Date(row.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                </p>
                <div className="mt-4 flex flex-col gap-2 md:flex-row">
                  <select
                    key={`${row.id}-${row.status}`}
                    defaultValue={row.status}
                    onChange={(event) => updateStatus(row.id, event.target.value)}
                    className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
                  >
                    {BOOKING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={note[row.id] ?? ""}
                    onChange={(event) =>
                      setNote((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                    placeholder="Optional note (saved on next status change)"
                    className="h-11 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
