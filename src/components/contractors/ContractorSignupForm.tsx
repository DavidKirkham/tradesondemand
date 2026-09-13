"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { KC_METRO_CITIES } from "@/lib/kc-metro";
import { TRADES } from "@/lib/trades";
import { CallButton } from "../CallButton";

type TradeRateDraft = { hourly: string; minimum: string };

const INITIAL = {
  businessName: "",
  contactName: "",
  phone: "",
  email: "",
  licenseNumber: "",
  licenseType: "",
  licenseState: "" as "" | "MO" | "KS",
  serviceArea: "",
  insured: false,
  insuranceDetails: "",
  yearsExperience: "",
  bio: "",
  hourlyRate: "",
  minimumCharge: "",
  emergencyRate: "",
  agreedToTerms: false,
};

export function ContractorSignupForm() {
  const [form, setForm] = useState(INITIAL);
  const [trades, setTrades] = useState<string[]>([]);
  const [tradeRates, setTradeRates] = useState<Record<string, TradeRateDraft>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ publicId: string } | null>(null);

  const selectedTrades = useMemo(
    () => TRADES.filter((trade) => trades.includes(trade.slug)),
    [trades],
  );

  function set<K extends keyof typeof INITIAL>(key: K, value: (typeof INITIAL)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function toggleTrade(slug: string) {
    setTrades((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug];
      setTradeRates((rates) => {
        const copy = { ...rates };
        if (!next.includes(slug)) delete copy[slug];
        else if (!copy[slug]) copy[slug] = { hourly: form.hourlyRate, minimum: form.minimumCharge };
        return copy;
      });
      return next;
    });
    setError("");
  }

  function addCity(city: string) {
    const next = form.serviceArea
      ? form.serviceArea.includes(city)
        ? form.serviceArea
        : `${form.serviceArea}, ${city}`
      : city;
    set("serviceArea", next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          trades,
          tradeRates: selectedTrades.map((trade) => ({
            slug: trade.slug,
            hourly: tradeRates[trade.slug]?.hourly || form.hourlyRate,
            minimum: tradeRates[trade.slug]?.minimum || form.minimumCharge,
          })),
        }),
      });
      const payload = (await response.json()) as { error?: string; publicId?: string };
      if (!response.ok || !payload.publicId) {
        setError(payload.error || "We could not save that application. Call dispatch.");
        return;
      }
      setResult({ publicId: payload.publicId });
    } catch {
      setError("Network issue. Try again or call the KC desk.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-ok/20 bg-paper p-6 shadow-sm md:p-8">
        <p className="stamp text-xs text-ok">Application received</p>
        <h2 className="mt-2 font-display text-3xl text-navy">You&apos;re in review.</h2>
        <p className="mt-3 text-muted">
          Application <span className="font-mono font-semibold text-navy">{result.publicId}</span> is
          with the KC ops desk. We only publish licensed metro partners after a human looks at the
          license and insurance. You will not appear in the directory until you are approved.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/contractors"
            className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
          >
            See the public directory
          </Link>
          <CallButton variant="ghost" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8 rounded-2xl border border-line bg-paper p-5 shadow-sm md:p-8">
      <section className="space-y-4">
        <h2 className="font-display text-xl text-navy">Who&apos;s applying</h2>
        <Field label="Business / contractor name" value={form.businessName} onChange={(v) => set("businessName", v)} placeholder="Brookside Mechanical" />
        <Field label="Contact name" value={form.contactName} onChange={(v) => set("contactName", v)} placeholder="Sam Ortiz" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="(816) 516-0735" inputMode="tel" />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="dispatch@yourshop.com" inputMode="email" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-navy">Trades you are licensed for</h2>
        <p className="text-sm text-muted">Same all-trades list customers book. Include Other if you general-contract.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TRADES.map((trade) => {
            const active = trades.includes(trade.slug);
            return (
              <button
                key={trade.slug}
                type="button"
                onClick={() => toggleTrade(trade.slug)}
                className={`rounded-xl border px-3 py-3 text-left text-sm ${
                  active ? "border-navy bg-navy text-cream" : "border-line bg-cream/40"
                }`}
              >
                {trade.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-navy">License — Missouri or Kansas</h2>
        <p className="text-sm text-muted">This desk is for licensed KC-metro contractors only. Unlicensed labor is not accepted.</p>
        <Field label="License number" value={form.licenseNumber} onChange={(v) => set("licenseNumber", v)} placeholder="MO-PL-44219" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="License type" value={form.licenseType} onChange={(v) => set("licenseType", v)} placeholder="Master plumber" />
          <label className="block">
            <span className="text-sm font-medium text-navy">License state</span>
            <select
              value={form.licenseState}
              onChange={(event) => set("licenseState", event.target.value as "MO" | "KS" | "")}
              className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
            >
              <option value="">Select</option>
              <option value="MO">Missouri</option>
              <option value="KS">Kansas</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-navy">KC metro service area</h2>
        <p className="text-sm text-muted">Cities or ZIPs you actually cover. Out-of-metro shops will be declined.</p>
        <div className="flex flex-wrap gap-2">
          {KC_METRO_CITIES.slice(0, 10).map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => addCity(city)}
              className="rounded-full border border-line px-3 py-1 text-xs text-navy"
            >
              {city}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-sm font-medium text-navy">Cities / ZIPs</span>
          <textarea
            value={form.serviceArea}
            onChange={(event) => set("serviceArea", event.target.value)}
            rows={3}
            placeholder="Kansas City, Overland Park, Independence, 64111…"
            className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
          />
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-navy">Rates &amp; minimums (USD)</h2>
        <p className="text-sm text-muted">
          Enter a primary hourly rate and a trip / service-call minimum. If you cover more than one
          trade, you can override those numbers per trade. After-hours is optional. Customers pay
          Trades on Demand — these are the amounts TOD quotes from.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Primary hourly rate"
            value={form.hourlyRate}
            onChange={(v) => set("hourlyRate", v)}
            placeholder="95"
            inputMode="decimal"
            prefix="$"
          />
          <Field
            label="Service-call minimum / trip fee"
            value={form.minimumCharge}
            onChange={(v) => set("minimumCharge", v)}
            placeholder="149"
            inputMode="decimal"
            prefix="$"
          />
          <Field
            label="Emergency / after-hours (optional)"
            value={form.emergencyRate}
            onChange={(v) => set("emergencyRate", v)}
            placeholder="175"
            inputMode="decimal"
            prefix="$"
          />
        </div>
        {selectedTrades.length > 1 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-navy">Per-trade rates (optional overrides)</p>
            {selectedTrades.map((trade) => (
              <div key={trade.slug} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <p className="self-center text-sm font-medium text-navy">{trade.name}</p>
                <Field
                  label="Hourly"
                  value={tradeRates[trade.slug]?.hourly ?? ""}
                  onChange={(value) =>
                    setTradeRates((current) => ({
                      ...current,
                      [trade.slug]: { hourly: value, minimum: current[trade.slug]?.minimum ?? "" },
                    }))
                  }
                  placeholder={form.hourlyRate || "95"}
                  inputMode="decimal"
                  prefix="$"
                />
                <Field
                  label="Service-call min"
                  value={tradeRates[trade.slug]?.minimum ?? ""}
                  onChange={(value) =>
                    setTradeRates((current) => ({
                      ...current,
                      [trade.slug]: { hourly: current[trade.slug]?.hourly ?? "", minimum: value },
                    }))
                  }
                  placeholder={form.minimumCharge || "149"}
                  inputMode="decimal"
                  prefix="$"
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-navy">Insurance &amp; profile</h2>
        <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={form.insured}
            onChange={(event) => set("insured", event.target.checked)}
            className="mt-1"
          />
          <span>I carry active liability insurance for work in the Kansas City metro.</span>
        </label>
        <Field label="Policy details (optional)" value={form.insuranceDetails} onChange={(v) => set("insuranceDetails", v)} placeholder="Carrier + policy number" />
        <Field label="Years of experience (optional)" value={form.yearsExperience} onChange={(v) => set("yearsExperience", v)} placeholder="12" inputMode="numeric" />
        <label className="block">
          <span className="text-sm font-medium text-navy">Short bio (optional)</span>
          <textarea
            value={form.bio}
            onChange={(event) => set("bio", event.target.value)}
            rows={4}
            maxLength={800}
            placeholder="KC neighborhoods you cover, crew size, what you will not take…"
            className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
          />
        </label>
      </section>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.agreedToTerms}
          onChange={(event) => set("agreedToTerms", event.target.checked)}
          className="mt-1"
        />
        <span>
          I confirm this application is accurate, I am licensed for the trades selected, and I agree
          that customers pay Trades on Demand (TOD pays me). Bank payout details are coming later
          — do not collect cards or cash as the merchant on TOD jobs.
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-full bg-ember text-sm font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {submitting ? "Sending application…" : "Submit for review"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      <span className="relative mt-2 block">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
            {prefix}
          </span>
        ) : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={`h-12 w-full rounded-xl border border-line bg-white text-sm outline-none ring-ember/30 focus:ring-2 ${
            prefix ? "pl-7 pr-3" : "px-3"
          }`}
        />
      </span>
    </label>
  );
}
