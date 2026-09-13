const MAX_CENTS = 1_000_000;

export function parseUsdToCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (!cents || cents <= 0) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
