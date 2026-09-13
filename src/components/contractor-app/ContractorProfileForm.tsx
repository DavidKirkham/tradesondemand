"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { centsToInput } from "@/lib/money";
import { getTrade } from "@/lib/trades";

export function ContractorProfileForm({
  bio,
  serviceArea,
  hourlyRateCents,
  minimumChargeCents,
  emergencyRateCents,
  yearsExperience,
  trades,
  tradeRates,
  slug,
}: {
  bio: string | null;
  serviceArea: string;
  hourlyRateCents: number;
  minimumChargeCents: number;
  emergencyRateCents: number | null;
  yearsExperience: number | null;
  trades: string[];
  tradeRates: { slug: string; hourlyCents: number; minimumCents: number }[];
  slug: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    bio: bio ?? "",
    serviceArea,
    hourlyRate: centsToInput(hourlyRateCents),
    minimumCharge: centsToInput(minimumChargeCents),
    emergencyRate: centsToInput(emergencyRateCents),
    yearsExperience: yearsExperience != null ? String(yearsExperience) : "",
  });
  const [rateDrafts, setRateDrafts] = useState<Record<string, { hourly: string; minimum: string }>>(
    () => {
      const next: Record<string, { hourly: string; minimum: string }> = {};
      for (const rate of tradeRates) {
        next[rate.slug] = {
          hourly: centsToInput(rate.hourlyCents),
          minimum: centsToInput(rate.minimumCents),
        };
      }
      return next;
    },
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/contractor/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tradeRates: trades.map((slug) => ({
          slug,
          hourly: rateDrafts[slug]?.hourly || form.hourlyRate,
          minimum: rateDrafts[slug]?.minimum || form.minimumCharge,
        })),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not save profile.");
      return;
    }
    setMessage("Profile saved. Customers see these rates and your bio.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-navy">KC coverage</span>
        <textarea
          value={form.serviceArea}
          onChange={(event) => setForm((current) => ({ ...current, serviceArea: event.target.value }))}
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-navy">Bio</span>
        <textarea
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
          rows={4}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Hourly"
          value={form.hourlyRate}
          onChange={(value) => setForm((current) => ({ ...current, hourlyRate: value }))}
        />
        <Field
          label="Trip min"
          value={form.minimumCharge}
          onChange={(value) => setForm((current) => ({ ...current, minimumCharge: value }))}
        />
        <Field
          label="After-hours"
          value={form.emergencyRate}
          onChange={(value) => setForm((current) => ({ ...current, emergencyRate: value }))}
        />
        <Field
          label="Years"
          value={form.yearsExperience}
          onChange={(value) => setForm((current) => ({ ...current, yearsExperience: value }))}
        />
      </div>
      {trades.length > 1
        ? trades.map((slug) => (
            <div key={slug} className="grid grid-cols-2 gap-2">
              <p className="col-span-2 text-xs font-medium text-muted">{getTrade(slug)?.name ?? slug}</p>
              <input
                value={rateDrafts[slug]?.hourly ?? ""}
                onChange={(event) =>
                  setRateDrafts((current) => ({
                    ...current,
                    [slug]: { hourly: event.target.value, minimum: current[slug]?.minimum ?? form.minimumCharge },
                  }))
                }
                className="h-10 rounded-lg border border-line px-3 text-sm"
                placeholder="Hourly"
              />
              <input
                value={rateDrafts[slug]?.minimum ?? ""}
                onChange={(event) =>
                  setRateDrafts((current) => ({
                    ...current,
                    [slug]: { hourly: current[slug]?.hourly ?? form.hourlyRate, minimum: event.target.value },
                  }))
                }
                className="h-10 rounded-lg border border-line px-3 text-sm"
                placeholder="Trip min"
              />
            </div>
          ))
        : null}
      {message ? <p className="text-sm text-navy">{message}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save public profile"}
      </button>
      <a href={`/contractors/${slug}`} className="block text-center text-sm font-semibold text-ember">
        View public profile
      </a>
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
