import type { Metadata } from "next";
import { AccountEditor } from "@/components/account/AccountEditor";
import { AccountPasswordForm } from "@/components/account/AccountPasswordForm";
import { AccountShell } from "@/components/account/AccountShell";
import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const customer = await requireCustomer("/account/profile");
  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, street: true, city: true, state: true, zip: true },
  });
  const addresses = Array.from(
    new Map(
      bookings.map((booking) => [
        `${booking.street}|${booking.city}|${booking.state}|${booking.zip}`,
        booking,
      ]),
    ).values(),
  );

  return (
    <AccountShell name={customer.name} needsPassword={!customer.passwordHash}>
      <h2 className="font-display text-2xl text-navy">Contact</h2>
      <div className="mt-4">
        <AccountEditor
          name={customer.name}
          email={customer.email}
          phone={customer.phone}
          preferredContact={customer.preferredContact}
        />
      </div>

      <h2 className="mt-10 font-display text-2xl text-navy">Password</h2>
      <div className="mt-4">
        <AccountPasswordForm hasPassword={Boolean(customer.passwordHash)} />
      </div>

      <h2 className="mt-10 font-display text-2xl text-navy">Service addresses</h2>
      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Addresses appear after you book a KC job.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-navy">
          {addresses.map((row, index) => (
            <li key={row.id} className="rounded-xl border border-line bg-paper px-4 py-3">
              {index === 0 ? <p className="stamp mb-1 text-[0.65rem] text-muted">Most recent</p> : null}
              {row.street}, {row.city}, {row.state} {row.zip}
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
