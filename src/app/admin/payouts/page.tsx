import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminPayoutTransfer } from "@/components/admin/AdminPayoutTransfer";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchNeedle } from "@/lib/admin";
import {
  filterPayoutQueue,
  loadPayoutQueue,
  owedPayoutTotalCents,
  payoutQueueHint,
} from "@/lib/admin-payouts";
import { formatUsd } from "@/lib/money";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminGate>
      <PayoutsQueue q={searchNeedle(params.q)} />
    </AdminGate>
  );
}

async function PayoutsQueue({ q }: { q: string }) {
  if (!(await isOpsAuthenticated())) return null;
  const rows = filterPayoutQueue(await loadPayoutQueue(), q);
  const owedCents = owedPayoutTotalCents(rows);

  return (
    <div>
      <p className="stamp text-xs text-ember">Pay shops</p>
      <h1 className="font-display text-3xl text-navy">Payouts</h1>
      <p className="mt-2 text-sm text-muted">
        Shop earnings owed to contractors after the customer pays TOD. Transfer the invoice{" "}
        <strong>shop subtotal</strong> to the Express account — never the 20% markup. Customers
        still pay Trademark Walls only; Checkout is unchanged.
      </p>
      <AdminSearch action="/admin/payouts" q={q} placeholder="Search job ID, invoice, or shop" />

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          {q ? "No payouts match that search." : "No shop payouts yet. They appear when a TOD invoice is paid."}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm font-semibold text-navy">
            {rows.length} {rows.length === 1 ? "payout" : "payouts"} · shop earnings owed{" "}
            {formatUsd(owedCents)}
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Subcontractor</th>
                  <th className="px-4 py-3 font-medium">Connect</th>
                  <th className="px-4 py-3 font-medium">Shop earnings</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Transfer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.payoutId} className="border-b border-line/70 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link href={row.jobHref} className="font-mono text-xs font-semibold text-ember hover:underline">
                        {row.jobPublicId}
                      </Link>
                      <p className="text-xs text-muted">
                        {row.invoicePublicId} · {row.publicId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.contractorHref && row.contractorName ? (
                        <Link href={row.contractorHref} className="font-semibold text-navy hover:underline">
                          {row.contractorName}
                        </Link>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.connectLabel}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy">{formatUsd(row.shopAmountCents)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        customer {formatUsd(row.customerSubtotalCents)} · markup{" "}
                        {formatUsd(row.markupCents)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={row.status === "FAILED" ? "font-semibold text-danger" : "text-navy"}>
                        {row.statusLabel}
                      </p>
                      <p className="mt-0.5 max-w-xs text-xs text-muted">{payoutQueueHint(row)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "PAID" ? (
                        <span className="text-xs text-muted">Done</span>
                      ) : (
                        <AdminPayoutTransfer
                          payoutId={row.payoutId}
                          canTransfer={row.canTransfer}
                          label={row.status === "FAILED" ? "Retry transfer" : "Transfer shop amount"}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
