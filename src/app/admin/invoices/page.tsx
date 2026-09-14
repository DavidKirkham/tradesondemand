import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchNeedle } from "@/lib/admin";
import {
  filterInvoicesDue,
  formatInvoiceDueDate,
  invoicesDueTotalCents,
  loadInvoicesDue,
  parseInvoiceDueSort,
} from "@/lib/admin-invoices-due";
import { invoiceStatusLabel } from "@/lib/invoice";
import { formatUsd } from "@/lib/money";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesDuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminGate>
      <InvoicesDueList q={searchNeedle(params.q)} sort={parseInvoiceDueSort(params.sort)} />
    </AdminGate>
  );
}

async function InvoicesDueList({ q, sort }: { q: string; sort: "oldest" | "amount" }) {
  if (!(await isOpsAuthenticated())) return null;
  const invoices = filterInvoicesDue(await loadInvoicesDue(sort), q);
  const totalCents = invoicesDueTotalCents(invoices);

  return (
    <div>
      <p className="stamp text-xs text-ember">Receivables</p>
      <h1 className="font-display text-3xl text-navy">Invoices due</h1>
      <p className="mt-2 text-sm text-muted">
        Customer balances still owed to TOD. Amounts are what the client pays (shop + 20% markup).
        Open a job to edit the invoice or chase payment.
      </p>
      <AdminSearch
        action="/admin/invoices"
        q={q}
        placeholder="Search job ID, invoice, client, or shop"
        extra={
          <label className="text-sm">
            <span className="sr-only">Sort</span>
            <select
              name="sort"
              defaultValue={sort}
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
            >
              <option value="oldest">Oldest first</option>
              <option value="amount">Highest due</option>
            </select>
          </label>
        }
      />

      {invoices.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          {q ? "No invoices match that search." : "Nothing is owed to TOD right now."}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm font-semibold text-navy">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} · customer owes{" "}
            {formatUsd(totalCents)}
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Subcontractor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Customer owes</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.invoiceId} className="border-b border-line/70 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={row.jobHref}
                        className="font-mono text-xs font-semibold text-ember hover:underline"
                      >
                        {row.jobPublicId}
                      </Link>
                      <p className="text-xs text-muted">{row.invoicePublicId}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.clientId ? (
                        <Link
                          href={`/admin/clients/${row.clientId}`}
                          className="font-semibold text-navy hover:underline"
                        >
                          {row.clientName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-navy">{row.clientName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.contractorId && row.contractorName ? (
                        <Link
                          href={`/admin/contractors/${row.contractorId}`}
                          className="text-navy hover:underline"
                        >
                          {row.contractorName}
                        </Link>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{invoiceStatusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-muted">{formatInvoiceDueDate(row.sentAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={row.jobHref} className="font-semibold text-ember hover:underline">
                        {formatUsd(row.amountDueCents)}
                      </Link>
                      {row.hasMarkup ? (
                        <p className="mt-0.5 text-xs text-muted">
                          shop {formatUsd(row.shopSubtotalCents)} · markup {formatUsd(row.markupCents)}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted">Legacy invoice — customer amount</p>
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
