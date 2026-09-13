"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rateForTrade, type PublicContractor } from "@/lib/contractor";
import { formatUsd } from "@/lib/money";
import { ContractorAvatar } from "../contractors/ContractorAvatar";

export function ContractorPicker({
  trade,
  urgency,
  selectedId,
  onSelect,
}: {
  trade: string;
  urgency: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [rows, setRows] = useState<PublicContractor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contractors?trade=${encodeURIComponent(trade)}`)
      .then((response) => response.json())
      .then((payload: { contractors?: PublicContractor[] }) => {
        if (!cancelled) setRows(payload.contractors ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trade]);

  if (rows === null) {
    return <p className="text-sm text-muted">Loading licensed partners for this trade…</p>;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`w-full rounded-2xl border p-4 text-left ${
          !selectedId ? "border-navy bg-navy/5" : "border-line bg-cream/40"
        }`}
      >
        <p className="font-display text-lg text-navy">First available — we&apos;ll match you</p>
        <p className="mt-1 text-sm text-muted">
          Dispatch assigns an approved KC partner. Use this if you do not have a preference.
        </p>
      </button>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">
          No approved contractor has listed this trade yet. We can still take the job and match you.
        </p>
      ) : (
        rows.map((contractor) => {
          const rate = rateForTrade(contractor, trade);
          const showEmergency = urgency === "emergency" && contractor.emergencyRateCents;
          const active = selectedId === contractor.id;
          return (
            <button
              key={contractor.id}
              type="button"
              onClick={() => onSelect(contractor.id)}
              className={`flex w-full gap-3 rounded-2xl border p-4 text-left ${
                active ? "border-navy bg-navy/5" : "border-line bg-cream/40"
              }`}
            >
              <ContractorAvatar name={contractor.businessName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg text-navy">{contractor.businessName}</span>
                  <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[0.65rem] font-semibold text-ok">
                    Licensed
                  </span>
                </span>
                <span className="mt-1 block text-sm text-navy">
                  {formatUsd(rate.hourlyCents)}/hr · {formatUsd(rate.minimumCents)} min
                  {showEmergency ? ` · after-hours ${formatUsd(contractor.emergencyRateCents ?? 0)}` : ""}
                </span>
                <span className="mt-1 block text-xs text-muted">{contractor.serviceArea}</span>
                <Link
                  href={`/contractors/${contractor.slug}`}
                  className="mt-2 inline-block text-xs font-semibold text-ember"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open profile
                </Link>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
