import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchNeedle } from "@/lib/admin";
import { contractorStatusLabel, parseTradesJson } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { formatUsd } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getTrade, isKnownTrade, TRADES } from "@/lib/trades";

export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export default async function AdminContractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; trade?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminGate>
      <ContractorsList
        q={searchNeedle(params.q)}
        status={params.status ?? "ALL"}
        trade={params.trade ?? "ALL"}
        deleted={searchNeedle(params.deleted)}
      />
    </AdminGate>
  );
}

async function ContractorsList({
  q,
  status,
  trade,
  deleted,
}: {
  q: string;
  status: string;
  trade: string;
  deleted: string;
}) {
  if (!(await isOpsAuthenticated())) return null;
  const rows = await prisma.contractor.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { businessName: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q.replace(/\D/g, "") || q } },
              { publicId: { contains: q, mode: "insensitive" } },
              { licenseNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bookings: true } } },
  });

  const contractors = rows.filter((row) => {
    if (trade === "ALL" || !isKnownTrade(trade)) return true;
    return parseTradesJson(row.tradesJson).includes(trade);
  });

  return (
    <div>
      <p className="stamp text-xs text-ember">Partners</p>
      <h1 className="font-display text-3xl text-navy">Subcontractors</h1>
      <p className="mt-2 text-sm text-muted">
        All application statuses. Only approved shops appear on the public directory. Delete a shop
        from its detail page after typing the business name.
      </p>
      {deleted ? (
        <p className="mt-4 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-navy">
          {deleted} was deleted. Portal login, push subscriptions, and password-reset rows are gone.
          Completed or cancelled jobs stay on the books as unassigned.
        </p>
      ) : null}
      <AdminSearch
        action="/admin/contractors"
        q={q}
        placeholder="Search business, contact, email, phone, or license"
        extra={
          <>
            <label className="text-sm">
              <span className="sr-only">Status</span>
              <select
                name="status"
                defaultValue={status}
                className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === "ALL" ? "All statuses" : contractorStatusLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="sr-only">Trade</span>
              <select
                name="trade"
                defaultValue={trade}
                className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
              >
                <option value="ALL">All trades</option>
                {TRADES.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
      />

      {contractors.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          No subcontractors match.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Trades</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Jobs</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((row) => {
                const trades = parseTradesJson(row.tradesJson);
                return (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/contractors/${row.id}`}
                        className="font-semibold text-navy hover:underline"
                      >
                        {row.businessName}
                      </Link>
                      <p className="text-xs text-muted">{row.publicId}</p>
                    </td>
                    <td className="px-4 py-3">{contractorStatusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-muted">
                      {trades.map((slug) => getTrade(slug)?.name ?? slug).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">{formatUsd(row.hourlyRateCents)}/hr</td>
                    <td className="px-4 py-3">{row._count.bookings}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/contractors/${row.id}#delete`}
                        className="text-sm font-semibold text-danger hover:underline"
                      >
                        Delete
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
