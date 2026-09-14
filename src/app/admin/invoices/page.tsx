import { AdminGate } from "@/components/admin/AdminGate";
import { AdminInvoicesDueTable } from "@/components/admin/AdminInvoicesDueTable";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchNeedle } from "@/lib/admin";
import {
  filterInvoicesDue,
  invoicesDueTotalCents,
  loadInvoicesDue,
  parseInvoiceDueSort,
  toAdminInvoiceDueTableRow,
} from "@/lib/admin-invoices-due";
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
  const rows = invoices.map(toAdminInvoiceDueTableRow);

  return (
    <div>
      <p className="stamp text-xs text-ember">Receivables</p>
      <h1 className="font-display text-3xl text-navy">Invoices due</h1>
      <p className="mt-2 text-sm text-muted">
        Customer balances still owed to TOD. Amounts are what the client pays (shop after any
        discount + 20% markup). Click a row, the amount, or Edit to correct lines or add a shop
        discount without leaving this list.
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
          <AdminInvoicesDueTable rows={rows} />
        </>
      )}
    </div>
  );
}
