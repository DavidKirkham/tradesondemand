import {
  customerFacingInvoiceLines,
  customerFacingInvoiceTotals,
  formatHours,
  invoiceHasStoredMarkup,
  invoiceStatusLabel,
  type InvoiceMoneyFields,
} from "@/lib/invoice";
import { formatUsd } from "@/lib/money";

export type InvoiceBreakdownLine = {
  id?: string;
  kind: string;
  description: string;
  quantity: string;
  unitCents: number;
  amountCents: number;
};

export function InvoiceBreakdown({
  publicId,
  status,
  lines,
  laborCents,
  materialsCents,
  subtotalCents,
  customerSubtotalCents,
  markupCents,
  depositPaidCents,
  amountDueCents,
  note,
  variant = "customer",
}: InvoiceMoneyFields & {
  publicId?: string | null;
  status: string;
  lines: InvoiceBreakdownLine[];
  note?: string | null;
  variant?: "customer" | "contractor" | "admin";
}) {
  const money = {
    laborCents,
    materialsCents,
    subtotalCents,
    customerSubtotalCents,
    markupCents,
    depositPaidCents,
    amountDueCents,
  };
  const markedUp = invoiceHasStoredMarkup(money);
  const customerTotals = customerFacingInvoiceTotals(money);
  const displayLines =
    variant === "customer" ? customerFacingInvoiceLines(lines, markedUp) : lines;
  const displayLabor = variant === "customer" ? customerTotals.laborCents : laborCents;
  const displayMaterials = variant === "customer" ? customerTotals.materialsCents : materialsCents;
  const displaySubtotal = variant === "customer" ? customerTotals.subtotalCents : subtotalCents;
  const labor = displayLines.filter((line) => line.kind === "LABOR");
  const materials = displayLines.filter((line) => line.kind === "MATERIAL");

  return (
    <div className="space-y-3 text-sm text-navy">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {publicId ? <p className="font-mono text-xs text-muted">{publicId}</p> : <span />}
        <p className="text-xs font-semibold text-muted">{invoiceStatusLabel(status)}</p>
      </div>

      {labor.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Labor</p>
          <ul className="mt-1 space-y-1">
            {labor.map((line, index) => (
              <li key={line.id ?? `labor-${index}`} className="flex justify-between gap-3">
                <span>
                  {line.description}
                  <span className="mt-0.5 block text-xs text-muted">
                    {formatHours(line.quantity)} hr × {formatUsd(line.unitCents)}
                  </span>
                </span>
                <span className="font-semibold">{formatUsd(line.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {materials.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Materials</p>
          <ul className="mt-1 space-y-1">
            {materials.map((line, index) => (
              <li key={line.id ?? `material-${index}`} className="flex justify-between gap-3">
                <span>{line.description}</span>
                <span className="font-semibold">{formatUsd(line.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="space-y-1 border-t border-line pt-2">
        {displayLabor > 0 ? <TotalRow label="Labor" value={displayLabor} /> : null}
        {displayMaterials > 0 ? <TotalRow label="Materials" value={displayMaterials} /> : null}
        <TotalRow
          label={variant === "customer" ? "Subtotal" : "Shop subtotal"}
          value={displaySubtotal}
        />
        {variant !== "customer" && markedUp ? (
          <>
            <TotalRow label="TOD 20% markup" value={customerTotals.markupCents} />
            <TotalRow label="Customer total" value={customerTotals.subtotalCents} />
          </>
        ) : variant === "admin" && !markedUp ? (
          <p className="text-xs text-muted">Legacy invoice — stored before platform markup.</p>
        ) : null}
        {depositPaidCents > 0 ? (
          <TotalRow label="Deposit already paid to TOD" value={-depositPaidCents} />
        ) : null}
        <div className="flex justify-between gap-3 pt-1 font-semibold">
          <dt>{variant === "customer" ? "Owed to TOD" : "Customer owes TOD"}</dt>
          <dd>{formatUsd(amountDueCents)}</dd>
        </div>
      </dl>

      {note ? <p className="text-xs text-muted">{note}</p> : null}
      <p className="text-xs text-muted">
        {variant === "customer"
          ? "Customers pay Trades on Demand (Trademark Walls). Prices include the TOD platform fee. The contractor is not the merchant of record."
          : "Customers pay Trades on Demand (Trademark Walls) at shop amounts plus a 20% platform fee. You are not the merchant of record."}
      </p>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3 text-muted">
      <dt>{label}</dt>
      <dd>{formatUsd(value)}</dd>
    </div>
  );
}
