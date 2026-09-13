"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { evaluateServiceArea } from "@/lib/kc-metro";
import { rateForTrade, type PublicContractor } from "@/lib/contractor";
import { formatUsd } from "@/lib/money";
import { depositForBooking } from "@/lib/payments";
import { getQuotePreview, type Urgency } from "@/lib/quotes";
import { TRADES } from "@/lib/trades";
import { CallButton } from "../CallButton";
import { ContractorAvatar } from "../contractors/ContractorAvatar";
import { ContractorPicker } from "./ContractorPicker";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type FormState = {
  trade: string;
  problem: string;
  street: string;
  city: string;
  state: "MO" | "KS" | "";
  zip: string;
  urgency: Urgency | "";
  contractorId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
};

const INITIAL: FormState = {
  trade: "",
  problem: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  urgency: "",
  contractorId: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
};

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Trade" },
  { n: 2, label: "Address" },
  { n: 3, label: "Urgency" },
  { n: 4, label: "Pro" },
  { n: 5, label: "Quote" },
  { n: 6, label: "Confirm" },
];

export function BookingWizard({
  initialTrade = "",
  initialUrgency = "",
  initialContractorId = "",
}: {
  initialTrade?: string;
  initialUrgency?: Urgency | "";
  initialContractorId?: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    trade: initialTrade,
    urgency: initialUrgency,
    contractorId: initialContractorId,
  });
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    publicId: string;
    token: string;
    checkoutUrl?: string | null;
    stripeConfigured?: boolean;
    stripeMessage?: string | null;
    paymentStatus?: string;
  } | null>(null);
  const [partner, setPartner] = useState<PublicContractor | null>(null);

  const selectedTrade = TRADES.find((trade) => trade.slug === form.trade);
  const quote =
    form.trade && form.urgency ? getQuotePreview(form.trade, form.urgency) : null;
  const deposit =
    form.trade && form.urgency
      ? depositForBooking({
          urgency: form.urgency,
          trade: form.trade,
          contractor: partner
            ? {
                hourlyRateCents: partner.hourlyRateCents,
                minimumChargeCents: partner.minimumChargeCents,
                emergencyRateCents: partner.emergencyRateCents,
                tradeRates: partner.tradeRates,
              }
            : null,
        })
      : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "trade") next.contractorId = "";
      return next;
    });
    if (key === "trade") setPartner(null);
    setError("");
  }

  function goNext() {
    if (step === 1) {
      if (!form.trade) return setError("Pick the closest trade — or Other if you're not sure.");
      if (form.problem.trim().length < 8) {
        return setError("Describe the problem in a sentence so we send the right person.");
      }
    }
    if (step === 2) {
      const area = evaluateServiceArea({
        zip: form.zip,
        city: form.city,
        state: form.state,
      });
      if (!form.street.trim() || form.street.trim().length < 4) {
        return setError("Add a street address the tech can find.");
      }
      if (!area.ok) return setError(area.message);
    }
    if (step === 3 && !form.urgency) {
      return setError("Choose emergency or routine so we know how fast to move.");
    }
    setError("");
    setStep((current) => Math.min(6, current + 1) as Step);
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        error?: string;
        publicId?: string;
        token?: string;
        checkoutUrl?: string | null;
        stripeConfigured?: boolean;
        stripeMessage?: string | null;
        paymentStatus?: string;
      };
      if (!response.ok || !payload.publicId || !payload.token) {
        setError(payload.error || "We couldn't book that just now. Call dispatch.");
        return;
      }
      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setResult({
        publicId: payload.publicId,
        token: payload.token,
        checkoutUrl: payload.checkoutUrl,
        stripeConfigured: payload.stripeConfigured,
        stripeMessage: payload.stripeMessage,
        paymentStatus: payload.paymentStatus,
      });
    } catch {
      setError("Network issue. If this is an emergency, call us now.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-ok/20 bg-paper p-6 shadow-sm md:p-8">
        <p className="stamp text-xs text-ok">Booking confirmed</p>
        <h2 className="mt-2 font-display text-3xl text-navy">You&apos;re on the board.</h2>
        <p className="mt-3 text-muted">
          Job <span className="font-mono font-semibold text-navy">{result.publicId}</span> is in
          dispatch. Save the status link — it&apos;s the only way to check this ticket without calling.
        </p>
        {form.urgency === "emergency" ? (
          <p className="mt-4 rounded-xl bg-ember/10 px-4 py-3 text-sm text-ember-dark">
            Keep your phone on. For emergencies we assign a KC metro partner as soon as one is free.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-navy/5 px-4 py-3 text-sm text-navy">
            Routine jobs get a confirmed window. You&apos;ll see status move from Received to Dispatched.
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          You pay Trades on Demand. Payments are processed by Trademark Walls — never the
          contractor. Open your private profile for receipts and job history.
        </p>
        {result.stripeMessage ? (
          <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-navy">
            {result.stripeMessage}
          </p>
        ) : null}
        {result.paymentStatus === "PENDING" && !result.checkoutUrl ? (
          <Link
            href={`/book/retry?token=${result.token}`}
            className="mt-3 inline-flex text-sm font-semibold text-ember"
          >
            Retry TOD Checkout
          </Link>
        ) : null}
        <HiringSummary partner={partner} trade={form.trade} />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/status/${result.token}`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
          >
            View job status
          </Link>
          <Link
            href="/account"
            className="inline-flex h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-navy"
          >
            My profile
          </Link>
          <CallButton variant="ember" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-paper shadow-sm">
      <div className="border-b border-line px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="stamp text-[0.68rem] text-muted">Kansas City booking</p>
            <h1 className="font-display text-2xl text-navy md:text-3xl">Book a trade</h1>
          </div>
          <CallButton variant="ghost" label="Call instead" />
        </div>
        <ol className="mt-5 grid grid-cols-6 gap-1">
          {STEPS.map((item) => (
            <li key={item.n} className="min-w-0">
              <div
                className={`h-1.5 rounded-full ${item.n <= step ? "bg-ember" : "bg-cream-2"}`}
              />
              <p className="mt-2 hidden truncate text-[0.7rem] text-muted sm:block">{item.label}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="px-4 py-6 md:px-6">
        {step === 1 ? (
          <section className="space-y-5">
            <div>
              <h2 className="font-display text-xl text-navy">What do you need?</h2>
              <p className="mt-1 text-sm text-muted">
                Any trade in the KC metro. Pick the closest match — Other is always fine.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRADES.map((trade) => {
                const active = form.trade === trade.slug;
                return (
                  <button
                    key={trade.slug}
                    type="button"
                    onClick={() => update("trade", trade.slug)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      active
                        ? "border-navy bg-navy text-cream"
                        : "border-line bg-cream/40 text-navy hover:border-navy/30"
                    }`}
                  >
                    <span className="font-semibold">{trade.name}</span>
                    <span className={`mt-1 block text-xs ${active ? "text-cream/70" : "text-muted"}`}>
                      {trade.short}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-navy">What&apos;s going on?</span>
              <textarea
                value={form.problem}
                onChange={(event) => update("problem", event.target.value)}
                rows={4}
                placeholder="e.g. Water heater leaking in a Brookside basement, smell of gas is already cleared with the utility."
                className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none ring-ember/30 focus:ring-2"
              />
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl text-navy">Where&apos;s the job?</h2>
              <p className="mt-1 text-sm text-muted">
                We only dispatch in the Kansas City metro. Out-of-area ZIPs are declined before you
                confirm.
              </p>
            </div>
            <Field
              label="Street address"
              value={form.street}
              onChange={(value) => update("street", value)}
              placeholder="3921 Baltimore Ave"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="City"
                value={form.city}
                onChange={(value) => update("city", value)}
                placeholder="Kansas City"
              />
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-navy">State</span>
                <select
                  value={form.state}
                  onChange={(event) => update("state", event.target.value as FormState["state"])}
                  className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-ember/30 focus:ring-2"
                >
                  <option value="">Select</option>
                  <option value="MO">Missouri</option>
                  <option value="KS">Kansas</option>
                </select>
              </label>
              <Field
                label="ZIP"
                value={form.zip}
                onChange={(value) => update("zip", value)}
                placeholder="64111"
                inputMode="numeric"
              />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl text-navy">How urgent is this?</h2>
              <p className="mt-1 text-sm text-muted">
                If anyone is in danger, call 911 first. Then tap emergency so dispatch jumps the
                queue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update("urgency", "emergency")}
              className={`w-full rounded-2xl border p-5 text-left ${
                form.urgency === "emergency"
                  ? "border-ember bg-ember/10"
                  : "border-line bg-cream/40"
              }`}
            >
              <p className="stamp text-xs text-ember">Emergency</p>
              <p className="mt-1 font-display text-2xl text-navy">Need someone now</p>
              <p className="mt-2 text-sm text-muted">
                Burst pipe, no heat, lockout, off-track garage door, standing water.
                {selectedTrade
                  ? ` Common for ${selectedTrade.name.toLowerCase()}: ${selectedTrade.emergencyExamples.join(", ")}.`
                  : ""}
              </p>
            </button>
            <button
              type="button"
              onClick={() => update("urgency", "routine")}
              className={`w-full rounded-2xl border p-5 text-left ${
                form.urgency === "routine" ? "border-navy bg-navy/5" : "border-line bg-cream/40"
              }`}
            >
              <p className="stamp text-xs text-navy">Routine</p>
              <p className="mt-1 font-display text-2xl text-navy">This week is fine</p>
              <p className="mt-2 text-sm text-muted">
                Estimates, replacements, seasonal work, and anything that can wait for daylight.
              </p>
            </button>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl text-navy">Who do you want on the job?</h2>
              <p className="mt-1 text-sm text-muted">
                Pick a licensed KC partner you can look up, or let dispatch match the first
                available. Pending applicants never show here.
              </p>
            </div>
            <ContractorPicker
              trade={form.trade}
              urgency={form.urgency}
              selectedId={form.contractorId}
              onSelect={(id, contractor) => {
                update("contractorId", id);
                setPartner(contractor ?? null);
              }}
            />
          </section>
        ) : null}

        {step === 5 && quote ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl text-navy">Quote &amp; deposit — straight talk</h2>
              <p className="mt-1 text-sm text-muted">
                You pay Trades on Demand — never the contractor directly. Payments are processed by
                Trademark Walls. TOD then pays the partner.
              </p>
            </div>
            <div className="rounded-2xl bg-navy px-5 py-6 text-cream">
              <p className="stamp text-xs text-gold">Pay Trades on Demand</p>
              <p className="mt-2 font-display text-2xl">{quote.headline}</p>
              <p className="mt-4 text-3xl font-semibold text-gold">
                {deposit && deposit.amountCents > 0 ? formatUsd(deposit.amountCents) : "No deposit now"}
              </p>
              <p className="mt-3 text-sm leading-6 text-cream/80">
                {deposit?.summary ?? quote.holdDetail} The contractor is not the merchant of record
                and never sees your card.
              </p>
            </div>
            <HiringSummary partner={partner} trade={form.trade} />
            <p className="text-sm leading-6 text-muted">{quote.nextStep}</p>
            <p className="text-xs leading-5 text-muted">{quote.disclaimer}</p>
          </section>
        ) : null}

        {step === 6 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl text-navy">Who should dispatch call?</h2>
              <p className="mt-1 text-sm text-muted">
                We will text and email the status link. Phone is how the tech finds you on site.
              </p>
            </div>
            <Field
              label="Full name"
              value={form.customerName}
              onChange={(value) => update("customerName", value)}
              placeholder="Alex Morgan"
            />
            <Field
              label="Mobile phone"
              value={form.customerPhone}
              onChange={(value) => update("customerPhone", value)}
              placeholder="(816) 555-0199"
              inputMode="tel"
            />
            <Field
              label="Email"
              value={form.customerEmail}
              onChange={(value) => update("customerEmail", value)}
              placeholder="you@email.com"
              inputMode="email"
            />
            <p className="rounded-xl bg-navy/5 px-4 py-3 text-sm text-navy">
              You pay Trades on Demand
              {deposit ? ` — ${deposit.summary}` : ""}. The contractor is not the merchant of record
              and never sees your card. TOD pays the partner later.
            </p>
            <Review form={form} partner={partner} depositLabel={deposit?.summary ?? "TOD checkout"} />
          </section>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep((current) => Math.max(1, current - 1) as Step);
              }}
              className="h-12 rounded-full px-5 text-sm font-semibold text-navy"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 6 ? (
            <button
              type="button"
              onClick={goNext}
              className="h-12 rounded-full bg-navy px-6 text-sm font-semibold text-cream"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-12 rounded-full bg-ember px-6 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting
                ? "Charging TOD deposit…"
                : deposit && deposit.amountCents > 0
                  ? `Pay TOD ${formatUsd(deposit.amountCents)} & confirm`
                  : "Pay TOD & confirm booking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-ember/30 focus:ring-2"
      />
    </label>
  );
}

function Review({
  form,
  partner,
  depositLabel,
}: {
  form: FormState;
  partner: PublicContractor | null;
  depositLabel: string;
}) {
  const trade = useMemo(() => TRADES.find((item) => item.slug === form.trade), [form.trade]);
  return (
    <div className="space-y-3">
      <HiringSummary partner={partner} trade={form.trade} />
      <dl className="rounded-xl border border-line bg-cream/50 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted">Trade</dt>
          <dd className="font-medium text-navy">{trade?.name}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted">Urgency</dt>
          <dd className="font-medium capitalize text-navy">{form.urgency}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted">Address</dt>
          <dd className="text-right font-medium text-navy">
            {form.street}, {form.city}, {form.state} {form.zip}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted">Contractor</dt>
          <dd className="text-right font-medium text-navy">
            {partner ? partner.businessName : "First available match"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted">Pay TOD</dt>
          <dd className="text-right font-medium text-navy">{depositLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

function HiringSummary({ partner, trade }: { partner: PublicContractor | null; trade: string }) {
  if (!partner) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        First available — dispatch will match an approved licensed KC partner. Pending applicants
        are never assigned from this form.
      </div>
    );
  }

  const rate = rateForTrade(partner, trade);

  return (
    <div className="flex gap-3 rounded-xl border border-line bg-paper px-4 py-3">
      <ContractorAvatar name={partner.businessName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ok">Who you&apos;re hiring</p>
        <p className="font-display text-lg text-navy">{partner.businessName}</p>
        <p className="text-sm text-navy">
          {formatUsd(rate.hourlyCents)}/hr · {formatUsd(rate.minimumCents)} trip min · {partner.licenseState}{" "}
          licensed
        </p>
        <Link href={`/contractors/${partner.slug}`} className="mt-1 inline-block text-sm font-semibold text-ember">
          Open public profile
        </Link>
      </div>
    </div>
  );
}
