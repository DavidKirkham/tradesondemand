"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOOKING_STATUSES, statusLabel } from "@/lib/booking";
import { contractorStatusLabel, type PublicContractor } from "@/lib/contractor";
import { formatUsd } from "@/lib/money";
import { paymentStatusLabel, paymentTypeLabel } from "@/lib/payments";
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
  contractorId: string | null;
  matchPreference: string;
};

export type OpsContractor = PublicContractor & {
  contactName: string;
  phone: string;
  email: string;
  insuranceDetails: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export type OpsCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  bookingCount: number;
  paymentCount: number;
  createdAt: string;
};

export type OpsPayment = {
  id: string;
  publicId: string;
  amountCents: number;
  type: string;
  status: string;
  note: string | null;
  bookingPublicId: string;
  customerName: string;
  createdAt: string;
};

export function OpsBoard({
  initialBookings,
  initialContractors,
  contractorNames,
  initialCustomers,
  initialPayments,
}: {
  initialBookings: OpsBooking[];
  initialContractors: OpsContractor[];
  contractorNames: Record<string, string>;
  initialCustomers: OpsCustomer[];
  initialPayments: OpsPayment[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"jobs" | "contractors" | "customers" | "payments">("jobs");
  const [filter, setFilter] = useState("ALL");
  const [appFilter, setAppFilter] = useState("ALL");
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function updateBooking(id: string, status: string) {
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

  async function updateContractor(id: string, status: string) {
    const response = await fetch(`/api/ops/contractors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note[id] || undefined }),
    });
    if (!response.ok) {
      setError("Could not update that application.");
      return;
    }
    setNote((current) => ({ ...current, [id]: "" }));
    router.refresh();
  }

  async function updatePayment(id: string, status: string) {
    const response = await fetch(`/api/ops/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setError("Could not update that TOD payment.");
      return;
    }
    router.refresh();
  }

  const visibleJobs = initialBookings.filter((row) => filter === "ALL" || row.status === filter);
  const visibleApps = initialContractors.filter((row) => appFilter === "ALL" || row.status === appFilter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="stamp text-xs text-ember">Dispatch</p>
          <h1 className="font-display text-3xl text-navy">KC ops board</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("jobs")}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              tab === "jobs" ? "bg-navy text-cream" : "border border-line"
            }`}
          >
            Jobs ({initialBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("contractors")}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              tab === "contractors" ? "bg-navy text-cream" : "border border-line"
            }`}
          >
            Contractors ({initialContractors.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("customers")}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              tab === "customers" ? "bg-navy text-cream" : "border border-line"
            }`}
          >
            Customers ({initialCustomers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("payments")}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              tab === "payments" ? "bg-navy text-cream" : "border border-line"
            }`}
          >
            TOD pay ({initialPayments.length})
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {tab === "jobs" ? (
        <>
          <label className="mt-6 block text-sm">
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
          {visibleJobs.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
              No tickets in this filter.
            </p>
          ) : (
            <div className="mt-8 space-y-4">
              {visibleJobs.map((row) => {
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
                      {row.contractorId
                        ? `Requested: ${contractorNames[row.contractorId] ?? "licensed partner"}`
                        : "Match: first available"}
                      {" · "}
                      {row.customerName} · {row.customerPhone}
                    </p>
                    <div className="mt-4 flex flex-col gap-2 md:flex-row">
                      <select
                        key={`${row.id}-${row.status}`}
                        defaultValue={row.status}
                        onChange={(event) => updateBooking(row.id, event.target.value)}
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
        </>
      ) : tab === "contractors" ? (
        <>
          <label className="mt-6 block text-sm">
            <span className="mr-2 text-muted">Application</span>
            <select
              value={appFilter}
              onChange={(event) => setAppFilter(event.target.value)}
              className="h-10 rounded-lg border border-line bg-white px-2"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          {visibleApps.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
              No applications in this filter. Licensed shops apply at /contractors/signup.
            </p>
          ) : (
            <div className="mt-8 space-y-4">
              {visibleApps.map((row) => (
                <article key={row.id} className="rounded-2xl border border-line bg-paper p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-muted">{row.publicId}</p>
                      <h2 className="font-display text-2xl text-navy">{row.businessName}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {row.contactName} · {row.phone} · {row.email}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-navy">{contractorStatusLabel(row.status)}</p>
                  </div>
                  <p className="mt-3 text-sm text-navy">
                    {row.trades.map((slug) => getTrade(slug)?.name ?? slug).join(" · ")}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {row.licenseType} · {row.licenseState} #{row.licenseNumber} · {row.serviceArea}
                  </p>
                  <p className="mt-2 text-sm text-navy">
                    {formatUsd(row.hourlyRateCents)}/hr · {formatUsd(row.minimumChargeCents)} min
                    {row.emergencyRateCents ? ` · after-hours ${formatUsd(row.emergencyRateCents)}` : ""}
                  </p>
                  {row.insuranceDetails ? (
                    <p className="mt-1 text-xs text-muted">Insurance: {row.insuranceDetails}</p>
                  ) : null}
                  {row.status === "APPROVED" ? (
                    <Link href={`/contractors/${row.slug}`} className="mt-2 inline-block text-sm font-semibold text-ember">
                      Public profile
                    </Link>
                  ) : null}
                  <div className="mt-4 flex flex-col gap-2 md:flex-row">
                    <select
                      key={`${row.id}-${row.status}`}
                      defaultValue={row.status}
                      onChange={(event) => updateContractor(row.id, event.target.value)}
                      className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
                    >
                      <option value="PENDING">Pending review</option>
                      <option value="APPROVED">Approve (publish)</option>
                      <option value="REJECTED">Reject</option>
                    </select>
                    <input
                      value={note[row.id] ?? ""}
                      onChange={(event) =>
                        setNote((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      placeholder="Review note (saved on status change)"
                      className="h-11 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : tab === "customers" ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted">
            Private lookup only. Do not publish customer addresses. Contractors see job-site details
            on assigned tickets, not this list.
          </p>
          {initialCustomers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
              No customer profiles yet. They are created on first booking.
            </p>
          ) : (
            initialCustomers.map((row) => (
              <article key={row.id} className="rounded-2xl border border-line bg-paper p-5">
                <h2 className="font-display text-2xl text-navy">{row.name}</h2>
                <p className="text-sm text-muted">
                  {row.email} · {row.phone} · prefers {row.preferredContact.toLowerCase()}
                </p>
                <p className="mt-2 text-sm text-navy">
                  {row.bookingCount} jobs · {row.paymentCount} TOD payments
                </p>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted">
            Marketplace ledger: customer paid Trades on Demand. Mark refunds here. No contractor
            card data.
          </p>
          {initialPayments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
              No TOD payments yet.
            </p>
          ) : (
            initialPayments.map((row) => (
              <article key={row.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-xs text-muted">{row.publicId}</p>
                  <p className="font-display text-xl text-navy">
                    {formatUsd(row.amountCents)} · {paymentTypeLabel(row.type)}
                  </p>
                  <p className="text-sm text-muted">
                    {row.bookingPublicId} · {row.customerName}
                  </p>
                </div>
                <select
                  key={`${row.id}-${row.status}`}
                  defaultValue={row.status}
                  onChange={(event) => updatePayment(row.id, event.target.value)}
                  className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
                >
                  <option value="PENDING">{paymentStatusLabel("PENDING")}</option>
                  <option value="PAID">{paymentStatusLabel("PAID")}</option>
                  <option value="REFUNDED">{paymentStatusLabel("REFUNDED")}</option>
                </select>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
