"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  filterContractorsByQuery,
  intakeDeposit,
  partitionIntakeContractors,
  type AdminIntakeContractorOption,
} from "@/lib/admin-intake";
import { parseResponseJson } from "@/lib/http";
import { formatUsd } from "@/lib/money";
import { formatPhone, nationalUsDigits } from "@/lib/phone";
import { TRADES } from "@/lib/trades";

type FormState = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  street: string;
  city: string;
  state: "MO" | "KS" | "";
  zip: string;
  notes: string;
  trade: string;
  problem: string;
  urgency: "emergency" | "routine" | "";
  preferredTime: string;
  contractorId: string;
  contractorQuery: string;
  skipDeposit: boolean;
};

const INITIAL: FormState = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  street: "",
  city: "",
  state: "MO",
  zip: "",
  notes: "",
  trade: "",
  problem: "",
  urgency: "emergency",
  preferredTime: "",
  contractorId: "",
  contractorQuery: "",
  skipDeposit: true,
};

type SuccessPayload = {
  booking: {
    id: string;
    publicId: string;
    status: string;
    contractorId: string | null;
    contractorName: string | null;
  };
  customer: { id: string; created: boolean };
  assigned: boolean;
  assignError?: string;
};

export function AdminTakeCallForm({ contractors }: { contractors: AdminIntakeContractorOption[] }) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [field, setField] = useState<string | undefined>();
  const [matchNote, setMatchNote] = useState("");
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "trade") next.contractorId = "";
      return next;
    });
    setError("");
    setField(undefined);
  }

  const partitioned = useMemo(
    () => partitionIntakeContractors(contractors, form.trade, form.city, form.zip),
    [contractors, form.trade, form.city, form.zip],
  );
  const searchable = useMemo(
    () => [...partitioned.matching, ...partitioned.otherCoverage],
    [partitioned],
  );
  const visible = useMemo(
    () => filterContractorsByQuery(searchable, form.contractorQuery),
    [searchable, form.contractorQuery],
  );
  const selected = contractors.find((row) => row.id === form.contractorId) ?? null;
  const selectedCovers =
    selected && form.trade
      ? partitioned.matching.some((row) => row.id === selected.id)
      : true;

  const deposit = useMemo(() => {
    if (!form.trade || !form.urgency) return null;
    return intakeDeposit({
      skipDeposit: form.skipDeposit,
      urgency: form.urgency,
      trade: form.trade,
      contractor: selected
        ? {
            hourlyRateCents: selected.hourlyRateCents,
            minimumChargeCents: selected.minimumChargeCents,
            emergencyRateCents: selected.emergencyRateCents,
            tradeRates: selected.tradeRates,
          }
        : null,
    });
  }, [form.skipDeposit, form.trade, form.urgency, selected]);

  async function lookupClient(phone: string, email: string) {
    const digits = nationalUsDigits(phone);
    const emailValue = email.trim();
    if (digits.length !== 10 && !emailValue) {
      setMatchNote("");
      return;
    }
    const params = new URLSearchParams();
    if (digits.length === 10) params.set("phone", digits);
    if (emailValue) params.set("email", emailValue);
    const response = await fetch(`/api/admin/clients/lookup?${params}`);
    if (!response.ok) return;
    const payload = await parseResponseJson<{
      match?: {
        customer: { id: string; name: string; email: string; phone: string };
        lastAddress: { street: string; city: string; state: string; zip: string } | null;
      } | null;
    }>(response);
    if (!payload.match) {
      setMatchNote("New client — a profile will be created from this call.");
      return;
    }
    const { customer, lastAddress } = payload.match;
    setMatchNote(`Existing client: ${customer.name} · ${formatPhone(customer.phone)}`);
    setForm((current) => ({
      ...current,
      customerName: current.customerName || customer.name,
      customerEmail:
        current.customerEmail ||
        (customer.email.endsWith("@phone.tradesondemand.invalid") ? "" : customer.email),
      street: current.street || lastAddress?.street || "",
      city: current.city || lastAddress?.city || "",
      state:
        current.state ||
        (lastAddress?.state === "KS" ? "KS" : lastAddress?.state === "MO" ? "MO" : current.state),
      zip: current.zip || lastAddress?.zip || "",
    }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setError("");
    setField(undefined);
    const response = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trade: form.trade,
        problem: form.problem,
        urgency: form.urgency,
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        contractorId: form.contractorId,
        notes: form.notes,
        preferredTime: form.preferredTime,
        skipDeposit: form.skipDeposit,
      }),
    });
    const payload = await parseResponseJson<SuccessPayload & { error?: string; field?: string }>(response);
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not create that phone job.");
      setField(payload.field);
      return;
    }
    setSuccess(payload);
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-ok/30 bg-ok/10 p-5">
        <p className="stamp text-xs text-ok">Booked from call</p>
        <h2 className="mt-1 font-display text-2xl text-navy">
          {success.assigned ? "Job created and assigned" : "Job created — assign still needed"}
        </h2>
        <p className="mt-2 font-mono text-sm font-semibold text-navy">Tracking ID {success.booking.publicId}</p>
        <p className="mt-1 text-sm text-muted">
          {success.booking.contractorName
            ? `Assigned to ${success.booking.contractorName}. Status: ${success.booking.status}.`
            : "Unassigned — finish from job detail."}
        </p>
        {success.assignError ? <p className="mt-2 text-sm text-danger">{success.assignError}</p> : null}
        <p className="mt-2 text-sm text-muted">
          {success.customer.created ? "New client profile created." : "Matched an existing client."} Shop is notified
          the same way as Assign on job detail (push, SMS fallback if wired).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/admin/jobs/${success.booking.id}`}
            className="inline-flex h-11 items-center rounded-full bg-ember px-5 text-sm font-semibold text-white"
          >
            Open job detail
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setForm(INITIAL);
              setMatchNote("");
            }}
            className="inline-flex h-11 items-center rounded-full border border-line bg-paper px-5 text-sm font-semibold text-navy"
          >
            Take another call
          </button>
        </div>
      </div>
    );
  }

  if (contractors.length === 0) {
    return (
      <p className="rounded-2xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-navy">
        No approved subcontractors yet.{" "}
        <Link href="/admin/contractors?status=PENDING" className="font-semibold text-ember">
          Approve a shop
        </Link>{" "}
        before taking a call that needs a contractor on the ticket.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event);
      }}
      className="space-y-6"
    >
      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl text-navy">Customer</h2>
        <p className="mt-1 text-sm text-muted">Match an existing profile by phone or email, or create one from this call.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name" error={field === "customerName"}>
            <input
              value={form.customerName}
              onChange={(event) => update("customerName", event.target.value)}
              className={inputClass}
              autoComplete="name"
              required
            />
          </Field>
          <Field label="Phone" error={field === "customerPhone"}>
            <input
              value={form.customerPhone}
              onChange={(event) => update("customerPhone", event.target.value)}
              onBlur={(event) => void lookupClient(event.target.value, form.customerEmail)}
              className={inputClass}
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </Field>
          <Field label="Email (optional)" error={field === "customerEmail"}>
            <input
              type="email"
              value={form.customerEmail}
              onChange={(event) => update("customerEmail", event.target.value)}
              onBlur={(event) => void lookupClient(form.customerPhone, event.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </Field>
          <Field label="Preferred time (if any)">
            <input
              value={form.preferredTime}
              onChange={(event) => update("preferredTime", event.target.value)}
              className={inputClass}
              placeholder="After 4pm, tomorrow morning…"
            />
          </Field>
        </div>
        {matchNote ? <p className="mt-3 text-sm text-navy">{matchNote}</p> : null}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl text-navy">Site</h2>
        <p className="mt-1 text-sm text-muted">KC metro only. Dispatch phone (816) 516-0735.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Street" error={field === "street"}>
              <input
                value={form.street}
                onChange={(event) => update("street", event.target.value)}
                className={inputClass}
                autoComplete="street-address"
                required
              />
            </Field>
          </div>
          <Field label="City" error={field === "zip"}>
            <input
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
              className={inputClass}
              autoComplete="address-level2"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <select
                value={form.state}
                onChange={(event) => update("state", event.target.value as FormState["state"])}
                className={inputClass}
              >
                <option value="MO">MO</option>
                <option value="KS">KS</option>
              </select>
            </Field>
            <Field label="ZIP" error={field === "zip"}>
              <input
                value={form.zip}
                onChange={(event) => update("zip", event.target.value)}
                className={inputClass}
                autoComplete="postal-code"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Dispatch notes">
              <textarea
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                className={`${inputClass} h-24 py-2`}
                placeholder="Gate code, dog, tenant vs owner, how they heard about TOD…"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl text-navy">Job</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Trade" error={field === "trade"}>
            <select
              value={form.trade}
              onChange={(event) => update("trade", event.target.value)}
              className={inputClass}
              required
            >
              <option value="">Pick a trade…</option>
              {TRADES.map((trade) => (
                <option key={trade.slug} value={trade.slug}>
                  {trade.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Emergency vs routine" error={field === "urgency"}>
            <select
              value={form.urgency}
              onChange={(event) => update("urgency", event.target.value as FormState["urgency"])}
              className={inputClass}
              required
            >
              <option value="emergency">Emergency</option>
              <option value="routine">Routine</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Problem / description" error={field === "problem"}>
              <textarea
                value={form.problem}
                onChange={(event) => update("problem", event.target.value)}
                className={`${inputClass} h-28 py-2`}
                placeholder="What they said on the call — enough for the tech to show up ready."
                required
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl text-navy">Assign contractor</h2>
        <p className="mt-1 text-sm text-muted">
          Approved shops only. Matching trades and coverage rise to the top; you can still pick another licensed shop.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Search shops">
            <input
              value={form.contractorQuery}
              onChange={(event) => update("contractorQuery", event.target.value)}
              className={inputClass}
              placeholder="Name, trade, city, ZIP…"
            />
          </Field>
          <Field label="Contractor" error={field === "contractorId"}>
            <select
              value={form.contractorId}
              onChange={(event) => update("contractorId", event.target.value)}
              className={inputClass}
              required
            >
              <option value="">Pick an approved shop…</option>
              {partitioned.matching.length > 0 ? (
                <optgroup label="Approved — trade and coverage">
                  {visible
                    .filter((row) => partitioned.matching.some((match) => match.id === row.id))
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.businessName} · {row.serviceArea}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {partitioned.otherCoverage.length > 0 ? (
                <optgroup label="Approved — this trade, other coverage">
                  {visible
                    .filter((row) => partitioned.otherCoverage.some((match) => match.id === row.id))
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.businessName} · {row.serviceArea}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </select>
          </Field>
        </div>
        {form.trade && partitioned.matching.length === 0 && partitioned.otherCoverage.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            None of the approved shops list this trade. Approve or edit a shop before assigning.
          </p>
        ) : null}
        {selected && !selectedCovers ? (
          <p className="mt-3 rounded-xl border border-ember/30 bg-ember/5 px-3 py-2 text-sm text-navy">
            {selected.businessName} is licensed for this trade but may not list this city/ZIP in coverage. You can still assign.
          </p>
        ) : null}
        {partitioned.otherTrade.length > 0 && form.trade ? (
          <p className="mt-3 text-xs text-muted">
            Hidden (other trades): {partitioned.otherTrade.map((row) => row.businessName).join(", ")}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl text-navy">Deposit</h2>
        <p className="mt-1 text-sm text-muted">
          Phone jobs skip Stripe Checkout. A skipped deposit records $0 paid; a hold records a pending TOD amount on
          the ticket so you can collect later from the job. Customer still pays Trades on Demand, not the shop.
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm text-navy">
          <input
            type="checkbox"
            checked={form.skipDeposit}
            onChange={(event) => update("skipDeposit", event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-semibold">Skip deposit for this phone job</span>
            <span className="mt-0.5 block text-muted">
              Uncheck to record a pending hold
              {deposit && !form.skipDeposit ? ` (${formatUsd(deposit.amountCents)})` : ""}.
            </span>
          </span>
        </label>
      </section>

      {error ? (
        <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={(event) => void submit(event)}
        className="h-12 rounded-full bg-ember px-6 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Creating job…" : "Create job and assign"}
      </button>
    </form>
  );
}

const inputClass = "mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: boolean;
  children: import("react").ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className={`font-medium ${error ? "text-danger" : "text-navy"}`}>{label}</span>
      {children}
    </label>
  );
}
