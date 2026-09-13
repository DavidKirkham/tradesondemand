import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAssignJobToContractor } from "@/components/admin/AdminAssignJobToContractor";
import { AdminContractorDelete } from "@/components/admin/AdminContractorDelete";
import { AdminContractorEditor } from "@/components/admin/AdminContractorEditor";
import { AdminContractorPassword } from "@/components/admin/AdminContractorPassword";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminJobStatus } from "@/components/admin/AdminJobStatus";
import { contractorOffersTrade, jobIsAssignable } from "@/lib/admin-assign";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { contractorStatusLabel, parseTradeRatesJson, parseTradesJson } from "@/lib/contractor";
import { isPastContractorJob } from "@/lib/contractor-app";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function AdminContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminGate>
      <ContractorDetail id={id} />
    </AdminGate>
  );
}

async function ContractorDetail({ id }: { id: string }) {
  if (!(await isOpsAuthenticated())) return null;
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { customer: true },
        omit: BOOKING_SMS_OMIT,
      },
    },
  });
  if (!contractor) notFound();

  const trades = parseTradesJson(contractor.tradesJson);
  const pushable =
    contractor.status === "APPROVED"
      ? (
          await prisma.booking.findMany({
            where: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
            orderBy: { createdAt: "desc" },
            include: { contractor: true },
            take: 80,
            omit: BOOKING_SMS_OMIT,
          })
        )
          .filter(
            (job) =>
              job.contractorId !== contractor.id &&
              jobIsAssignable(job.status) &&
              contractorOffersTrade(contractor.tradesJson, job.trade),
          )
          .map((job) => ({
            id: job.id,
            publicId: job.publicId,
            trade: job.trade,
            city: job.city,
            zip: job.zip,
            status: job.status,
            contractorId: job.contractorId,
            contractorName: job.contractor?.businessName ?? null,
          }))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/contractors" className="text-sm font-semibold text-ember">
          ← Subcontractors
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl text-navy">{contractor.businessName}</h1>
          {contractor.status === "APPROVED" ? (
            <span className="inline-flex h-7 items-center rounded-full bg-ok/15 px-3 text-xs font-semibold text-ok">
              Approved
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          {contractor.publicId} · {contractorStatusLabel(contractor.status)} ·{" "}
          {formatPhone(contractor.phone)}
          {contractor.status === "APPROVED" ? (
            <>
              {" · "}
              <Link href={`/contractors/${contractor.slug}`} className="font-semibold text-ember">
                Public profile
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <AdminContractorPassword
        id={contractor.id}
        passwordSet={Boolean(contractor.passwordHash)}
        invitePath={contractor.passwordHash ? null : `/contractor/s/${contractor.loginToken}`}
      />

      <AdminContractorEditor
        key={`${contractor.id}-${contractor.status}`}
        id={contractor.id}
        businessName={contractor.businessName}
        contactName={contractor.contactName}
        phone={contractor.phone}
        email={contractor.email}
        trades={parseTradesJson(contractor.tradesJson)}
        licenseNumber={contractor.licenseNumber}
        licenseType={contractor.licenseType}
        licenseState={contractor.licenseState}
        serviceArea={contractor.serviceArea}
        insured={contractor.insured}
        insuranceDetails={contractor.insuranceDetails}
        yearsExperience={contractor.yearsExperience}
        bio={contractor.bio}
        hourlyRateCents={contractor.hourlyRateCents}
        minimumChargeCents={contractor.minimumChargeCents}
        emergencyRateCents={contractor.emergencyRateCents}
        tradeRates={parseTradeRatesJson(contractor.tradeRatesJson)}
        status={contractor.status}
        reviewNote={contractor.reviewNote}
      />

      {contractor.status === "APPROVED" ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-display text-2xl text-navy">Push a job to this shop</h2>
          <p className="mt-1 text-sm text-muted">
            Unassigned or reassignable tickets in {trades.map((slug) => getTrade(slug)?.name ?? slug).join(", ") || "their trades"}.
            Confirm if the job already belongs to another shop.
          </p>
          <div className="mt-4">
            <AdminAssignJobToContractor
              contractorId={contractor.id}
              contractorName={contractor.businessName}
              jobs={pushable}
            />
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-navy">Assigned jobs</h2>
          <Link href="/admin/jobs" className="text-sm font-semibold text-ember">
            All jobs
          </Link>
        </div>
        {contractor.bookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No jobs assigned to this shop yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-2/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Trade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {contractor.bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/admin/jobs/${booking.id}`} className="font-semibold text-ember">
                        {booking.publicId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {booking.customer ? (
                        <Link href={`/admin/clients/${booking.customer.id}`} className="text-navy hover:underline">
                          {booking.customer.name}
                        </Link>
                      ) : (
                        booking.customerName
                      )}
                    </td>
                    <td className="px-4 py-3">{getTrade(booking.trade)?.name ?? booking.trade}</td>
                    <td className="px-4 py-3">
                      <AdminJobStatus id={booking.id} status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminContractorDelete
        id={contractor.id}
        businessName={contractor.businessName}
        activeJobs={contractor.bookings
          .filter((booking) => !isPastContractorJob(booking.status))
          .map((booking) => ({
            id: booking.id,
            publicId: booking.publicId,
            status: booking.status,
          }))}
        closedJobCount={contractor.bookings.filter((booking) => isPastContractorJob(booking.status)).length}
      />
    </div>
  );
}
