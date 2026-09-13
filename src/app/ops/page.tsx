import { toPublicContractor } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";
import { OpsBoard } from "@/components/ops/OpsBoard";
import { OpsLogin } from "@/components/ops/OpsLogin";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const authed = await isOpsAuthenticated();
  if (!authed) {
    return <OpsLogin />;
  }

  const [bookings, contractors, customers, payments] = await Promise.all([
    prisma.booking.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.contractor.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bookings: true, payments: true } } },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: { booking: true, customer: true },
    }),
  ]);

  const contractorNames = Object.fromEntries(contractors.map((row) => [row.id, row.businessName]));

  return (
    <OpsBoard
      initialBookings={bookings.map((booking) => ({
        id: booking.id,
        publicId: booking.publicId,
        trade: booking.trade,
        urgency: booking.urgency,
        city: booking.city,
        state: booking.state,
        zip: booking.zip,
        street: booking.street,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        status: booking.status,
        problem: booking.problem,
        createdAt: booking.createdAt.toISOString(),
        contractorId: booking.contractorId,
        matchPreference: booking.matchPreference,
      }))}
      initialContractors={contractors.map((row) => ({
        ...toPublicContractor(row),
        contactName: row.contactName,
        phone: row.phone,
        email: row.email,
        insuranceDetails: row.insuranceDetails,
        reviewNote: row.reviewNote,
        createdAt: row.createdAt.toISOString(),
      }))}
      contractorNames={contractorNames}
      initialCustomers={customers.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        preferredContact: row.preferredContact,
        bookingCount: row._count.bookings,
        paymentCount: row._count.payments,
        createdAt: row.createdAt.toISOString(),
      }))}
      initialPayments={payments.map((row) => ({
        id: row.id,
        publicId: row.publicId,
        amountCents: row.amountCents,
        type: row.type,
        status: row.status,
        note: row.note,
        bookingPublicId: row.booking.publicId,
        customerName: row.customer?.name ?? row.booking.customerName,
        createdAt: row.createdAt.toISOString(),
      }))}
    />
  );
}
