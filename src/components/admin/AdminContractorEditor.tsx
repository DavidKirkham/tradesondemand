"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { contractorStatusLabel, showContractorReviewActions } from "@/lib/contractor";
import { centsToInput } from "@/lib/money";
import { TRADES } from "@/lib/trades";

type TradeRateDraft = { hourly: string; minimum: string };

export function AdminContractorEditor({
  id,
  businessName,
  contactName,
  phone,
  email,
  trades,
  licenseNumber,
  licenseType,
  licenseState,
  serviceArea,
  insured,
  insuranceDetails,
  yearsExperience,
  bio,
  hourlyRateCents,
  minimumChargeCents,
  emergencyRateCents,
  tradeRates,
  status,
  reviewNote,
}: {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  trades: string[];
  licenseNumber: string;
  licenseType: string;
  licenseState: string;
  serviceArea: string;
  insured: boolean;
  insuranceDetails: string | null;
  yearsExperience: number | null;
  bio: string | null;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  tradeRates: { slug: string; hourlyCents: number; minimumCents: number }[];
  status: string;
  reviewNote: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName,
    contactName,
    phone,
    email,
    licenseNumber,
    licenseType,
    licenseState,
    serviceArea,
    insured,
    insuranceDetails: insuranceDetails ?? "",
    yearsExperience: yearsExperience != null ? String(yearsExperience) : "",
    bio: bio ?? "",
    hourlyRate: centsToInput(hourlyRateCents),
    minimumCharge: centsToInput(minimumChargeCents),
    emergencyRate: centsToInput(emergencyRateCents),
    status,
    reviewNote: reviewNote ?? "",
  });
  const [selectedTrades, setSelectedTrades] = useState(trades);
  const [rateDrafts, setRateDrafts] = useState<Record<string, TradeRateDraft>>(() => {
    const next: Record<string, TradeRateDraft> = {};
    for (const rate of tradeRates) {
      next[rate.slug] = {
        hourly: centsToInput(rate.hourlyCents),
        minimum: centsToInput(rate.minimumCents),
      };
    }
    return next;
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((current) => (current.status === status ? current : { ...current, status }));
  }, [status]);

  const selected = useMemo(
    () => TRADES.filter((trade) => selectedTrades.includes(trade.slug)),
    [selectedTrades],
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleTrade(slug: string) {
    setSelectedTrades((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      setRateDrafts((rates) => {
        const copy = { ...rates };
        if (!next.includes(slug)) delete copy[slug];
        else if (!copy[slug]) copy[slug] = { hourly: form.hourlyRate, minimum: form.minimumCharge };
        return copy;
      });
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/contractors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        trades: selectedTrades,
        tradeRates: selected.map((trade) => ({
          slug: trade.slug,
          hourly: rateDrafts[trade.slug]?.hourly || form.hourlyRate,
          minimum: rateDrafts[trade.slug]?.minimum || form.minimumCharge,
        })),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not save subcontractor.");
      return;
    }
    setMessage("Subcontractor saved.");
    router.refresh();
  }

  async function setStatus(next: string) {
    set("status", next);
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/contractors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status: next,
        trades: selectedTrades,
        tradeRates: selected.map((trade) => ({
          slug: trade.slug,
          hourly: rateDrafts[trade.slug]?.hourly || form.hourlyRate,
          minimum: rateDrafts[trade.slug]?.minimum || form.minimumCharge,
        })),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not update status.");
      return;
    }
    setMessage(next === "APPROVED" ? "Approved and published." : next === "REJECTED" ? "Rejected." : "Set back to pending.");
    router.refresh();
  }

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-navy">Profile</h2>
        {showContractorReviewActions(form.status) ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus("APPROVED")}
              disabled={saving}
              className="h-10 rounded-full bg-ok px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setStatus("REJECTED")}
              disabled={saving}
              className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        ) : (
          <p
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ${
              form.status.trim().toUpperCase() === "REJECTED"
                ? "bg-danger/15 text-danger"
                : "bg-ok/15 text-ok"
            }`}
          >
            {contractorStatusLabel(form.status)}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Business name" value={form.businessName} onChange={(value) => set("businessName", value)} />
        <Field label="Contact name" value={form.contactName} onChange={(value) => set("contactName", value)} />
        <Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} />
        <Field label="Email" value={form.email} onChange={(value) => set("email", value)} />
        <Field label="License #" value={form.licenseNumber} onChange={(value) => set("licenseNumber", value)} />
        <Field label="License type" value={form.licenseType} onChange={(value) => set("licenseType", value)} />
        <label className="block text-sm">
          <span className="font-medium text-navy">License state</span>
          <select
            value={form.licenseState}
            onChange={(event) => set("licenseState", event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value="MO">Missouri</option>
            <option value="KS">Kansas</option>
          </select>
        </label>
        <Field
          label="Years experience"
          value={form.yearsExperience}
          onChange={(value) => set("yearsExperience", value)}
        />
      </div>

      <label className="block text-sm">
        <span className="font-medium text-navy">KC service area</span>
        <textarea
          value={form.serviceArea}
          onChange={(event) => set("serviceArea", event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-navy">Trades</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TRADES.map((trade) => (
            <label key={trade.slug} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedTrades.includes(trade.slug)}
                onChange={() => toggleTrade(trade.slug)}
              />
              {trade.name}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-muted">
        Shop rates the contractor earns. Customer checkout and public profiles add a 20% TOD markup.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Hourly rate (USD)" value={form.hourlyRate} onChange={(value) => set("hourlyRate", value)} />
        <Field
          label="Trip / service-call min"
          value={form.minimumCharge}
          onChange={(value) => set("minimumCharge", value)}
        />
        <Field
          label="After-hours / emergency"
          value={form.emergencyRate}
          onChange={(value) => set("emergencyRate", value)}
        />
      </div>

      {selected.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-navy">Per-trade rates</p>
          {selected.map((trade) => (
            <div key={trade.slug} className="grid gap-2 md:grid-cols-3">
              <p className="self-center text-sm text-muted">{trade.name}</p>
              <input
                value={rateDrafts[trade.slug]?.hourly ?? ""}
                onChange={(event) =>
                  setRateDrafts((current) => ({
                    ...current,
                    [trade.slug]: {
                      hourly: event.target.value,
                      minimum: current[trade.slug]?.minimum ?? form.minimumCharge,
                    },
                  }))
                }
                placeholder="Hourly"
                className="h-10 rounded-lg border border-line px-3 text-sm"
              />
              <input
                value={rateDrafts[trade.slug]?.minimum ?? ""}
                onChange={(event) =>
                  setRateDrafts((current) => ({
                    ...current,
                    [trade.slug]: {
                      hourly: current[trade.slug]?.hourly ?? form.hourlyRate,
                      minimum: event.target.value,
                    },
                  }))
                }
                placeholder="Trip min"
                className="h-10 rounded-lg border border-line px-3 text-sm"
              />
            </div>
          ))}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.insured}
          onChange={(event) => set("insured", event.target.checked)}
        />
        Liability insurance on file
      </label>
      <Field
        label="Insurance details"
        value={form.insuranceDetails}
        onChange={(value) => set("insuranceDetails", value)}
      />
      <label className="block text-sm">
        <span className="font-medium text-navy">Bio</span>
        <textarea
          value={form.bio}
          onChange={(event) => set("bio", event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Review note</span>
        <textarea
          value={form.reviewNote}
          onChange={(event) => set("reviewNote", event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        />
      </label>

      {message ? <p className="text-sm text-navy">{message}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save subcontractor"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-navy">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
      />
    </label>
  );
}
