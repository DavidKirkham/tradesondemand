import { parseTradesJson } from "./contractor";

export type AdminContractorOption = {
  id: string;
  businessName: string;
  publicId: string;
  trades: string[];
};

export type AdminAssignableJob = {
  id: string;
  publicId: string;
  trade: string;
  city: string;
  zip: string;
  status: string;
  contractorId: string | null;
  contractorName: string | null;
};

export function contractorOffersTrade(tradesJson: string, trade: string): boolean {
  return parseTradesJson(tradesJson).includes(trade);
}

export function filterApprovedContractorsForTrade(
  contractors: AdminContractorOption[],
  trade: string,
): AdminContractorOption[] {
  return contractors.filter((row) => !trade || row.trades.includes(trade));
}

/** RECEIVED jobs become DISPATCHED; in-progress jobs keep their status. */
export function nextStatusOnAdminAssign(current: string): string | null {
  if (current === "CANCELLED") return null;
  if (current === "RECEIVED") return "DISPATCHED";
  return current;
}

export function adminAssignEventNote(
  businessName: string,
  previousBusinessName?: string | null,
): string {
  const next = businessName.trim();
  const previous = previousBusinessName?.trim();
  if (previous && previous !== next) {
    return `Reassigned by admin from ${previous} to ${next}`;
  }
  return `Assigned by admin to ${next}`;
}

export function jobIsAssignable(status: string): boolean {
  return status !== "CANCELLED";
}

export function jobLabel(job: Pick<AdminAssignableJob, "publicId" | "trade" | "city" | "zip">): string {
  return `${job.publicId} · ${job.trade} · ${job.city} ${job.zip}`;
}
