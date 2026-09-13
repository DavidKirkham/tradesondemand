import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { searchDigits, searchNeedle } from "@/lib/admin";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <AdminGate>
      <ClientsList q={searchNeedle(q)} />
    </AdminGate>
  );
}

async function ClientsList({ q }: { q: string }) {
  if (!(await isOpsAuthenticated())) return null;
  const digits = searchDigits(q);
  const clients = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: digits.length >= 3 ? digits : q } },
            { bookings: { some: { publicId: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bookings: true, payments: true } } },
  });

  return (
    <div>
      <p className="stamp text-xs text-ember">Private</p>
      <h1 className="font-display text-3xl text-navy">Clients</h1>
      <p className="mt-2 text-sm text-muted">
        Customer profiles are not public. Search name, email, phone, or job ID.
      </p>
      <AdminSearch action="/admin/clients" q={q} placeholder="Search name, email, phone, or job ID" />

      {clients.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          {q ? "No clients match that search." : "No clients yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Jobs</th>
                <th className="px-4 py-3 font-medium">Pays</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${row.id}`} className="font-semibold text-navy hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.email}</td>
                  <td className="px-4 py-3 text-muted">{formatPhone(row.phone)}</td>
                  <td className="px-4 py-3">{row._count.bookings}</td>
                  <td className="px-4 py-3">{row._count.payments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
