import { formatHours, invoiceStatusLabel } from "@/lib/invoice";
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
  depositPaidCents,
  amountDueCents,
  note,
}: {
  publicId?: string | null;
  status: string;
  lines: InvoiceBreakdownLine[];
  laborCents: number;
  materialsCents: number;
  subtotalCents: number;
  depositPaidCents: number;
  amountDueCents: number;
  note?: string | null;
}) {
  const labor = lines.filter((line) => line.kind === "LABOR");
  const materials = lines.filter((line) => line.kind === "MATERIAL");

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
        {laborCents > 0 ? <TotalRow label="Labor" value={laborCents} /> : null}
        {materialsCents > 0 ? <TotalRow label="Materials" value={materialsCents} /> : null}
        <TotalRow label="Subtotal" value={subtotalCents} />
        {depositPaidCents > 0 ? (
          <TotalRow label="Deposit already paid to TOD" value={-depositPaidCents} />
        ) : null}
        <div className="flex justify-between gap-3 pt-1 font-semibold">
          <dt>Owed to TOD</dt>
          <dd>{formatUsd(amountDueCents)}</dd>
        </div>
      </dl>

      {note ? <p className="text-xs text-muted">{note}</p> : null}
      <p className="text-xs text-muted">
        Customers pay Trades on Demand (Trademark Walls). The contractor is not the merchant of
        record.
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
