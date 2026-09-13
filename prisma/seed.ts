import { PrismaClient } from "@prisma/client";
import { hashContractorPassword } from "../src/lib/contractor-password";
import { hashCustomerPassword } from "../src/lib/customer-password";

const prisma = new PrismaClient();

async function main() {
  const customerPasswordHash = await hashCustomerPassword("riley-demo-10");
  const customer = await prisma.customer.upsert({
    where: { email: "riley@example.com" },
    update: { passwordHash: customerPasswordHash, sessionToken: null },
    create: {
      email: "riley@example.com",
      name: "Riley Chen",
      phone: "8165550144",
      token: "demo-customer-token-kc",
      passwordHash: customerPasswordHash,
      preferredContact: "PHONE",
    },
  });

  const claimCustomer = await prisma.customer.upsert({
    where: { email: "jordan@example.com" },
    update: {},
    create: {
      email: "jordan@example.com",
      name: "Jordan Hale",
      phone: "8165550133",
      token: "demo-claim-customer-kc",
      preferredContact: "PHONE",
    },
  });

  const existingBookings = await prisma.booking.count();
  if (existingBookings === 0) {
    await prisma.booking.create({
      data: {
        publicId: "TOD-DEMO01",
        token: "demo-status-token-kc",
        trade: "hvac",
        problem: "Furnace blowing cold air in a Waldo bungalow after last night's freeze.",
        urgency: "emergency",
        street: "7434 Wornall Rd",
        city: "Kansas City",
        state: "MO",
        zip: "64114",
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerId: customer.id,
        quoteSummary: "Emergency hvac dispatch · $89–$149 dispatch hold",
        events: {
          create: { status: "RECEIVED", note: "Seeded demo ticket" },
        },
      },
    });
  } else {
    await prisma.booking.updateMany({
      where: { publicId: "TOD-DEMO01", customerId: null },
      data: { customerId: customer.id },
    });
  }

  const demoPasswordHash = await hashContractorPassword("waldo-demo-10");

  const contractor = await prisma.contractor.upsert({
    where: { slug: "waldo-heat-demo" },
    update: { loginToken: "tod-waldo-demo", passwordHash: demoPasswordHash, sessionToken: null },
    create: {
      publicId: "PRO-DEMO01",
      slug: "waldo-heat-demo",
      businessName: "Waldo Heat & Pipe",
      contactName: "Morgan Ellis",
      phone: "8165160735",
      email: "morgan@waldoheat.example",
      loginToken: "tod-waldo-demo",
      passwordHash: demoPasswordHash,
      tradesJson: JSON.stringify(["plumbing", "hvac"]),
      licenseNumber: "MO-HVAC-8812",
      licenseType: "Mechanical contractor",
      licenseState: "MO",
      serviceArea: "Kansas City, Brookside, Waldo, Independence",
      insured: true,
      insuranceDetails: "Heartland Mutual 4401",
      yearsExperience: 14,
      bio: "Missouri-side shop for heat, A/C, and wet work. We stay inside the KC metro.",
      hourlyRateCents: 11000,
      minimumChargeCents: 18900,
      emergencyRateCents: 17500,
      tradeRatesJson: JSON.stringify([
        { slug: "plumbing", hourlyCents: 9500, minimumCents: 14900 },
        { slug: "hvac", hourlyCents: 11000, minimumCents: 18900 },
      ]),
      status: "APPROVED",
    },
  });

  await prisma.booking.updateMany({
    where: { publicId: "TOD-DEMO01", contractorId: null },
    data: { contractorId: contractor.id, matchPreference: "SPECIFIC" },
  });

  await prisma.contractor.upsert({
    where: { slug: "pending-pipe-demo" },
    update: {},
    create: {
      publicId: "PRO-PEND01",
      slug: "pending-pipe-demo",
      businessName: "Pending Pipe Demo",
      contactName: "Casey Lee",
      phone: "8165550199",
      email: "casey@pending.example",
      loginToken: "tod-pending-demo",
      tradesJson: JSON.stringify(["plumbing"]),
      licenseNumber: "MO-PL-0000",
      licenseType: "Journeyman plumber",
      licenseState: "MO",
      serviceArea: "Kansas City",
      insured: true,
      hourlyRateCents: 9000,
      minimumChargeCents: 14900,
      tradeRatesJson: JSON.stringify([{ slug: "plumbing", hourlyCents: 9000, minimumCents: 14900 }]),
      status: "PENDING",
    },
  });

  const openExisting = await prisma.booking.findUnique({ where: { publicId: "TOD-OPEN01" } });
  if (!openExisting) {
    await prisma.booking.create({
      data: {
        publicId: "TOD-OPEN01",
        token: "demo-open-job-kc",
        trade: "plumbing",
        problem: "Kitchen sink backing up in a Brookside bungalow. First available.",
        urgency: "routine",
        street: "210 W 63rd St",
        city: "Kansas City",
        state: "MO",
        zip: "64113",
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerId: customer.id,
        quoteSummary: "Routine plumbing visit",
        events: { create: { status: "RECEIVED", note: "Open first-available ticket" } },
      },
    });
  }

  const demo = await prisma.booking.findUnique({
    where: { publicId: "TOD-DEMO01" },
    include: { payments: true },
  });
  if (demo && demo.payments.length === 0) {
    await prisma.payment.create({
      data: {
        publicId: "PAY-DEMO01",
        bookingId: demo.id,
        customerId: customer.id,
        amountCents: 17500,
        type: "DEPOSIT",
        status: "PENDING",
        note: "Seeded emergency hold — pending with TOD",
      },
    });
  }

  const doneExisting = await prisma.booking.findUnique({ where: { publicId: "TOD-DONE01" } });
  if (!doneExisting) {
    await prisma.booking.create({
      data: {
        publicId: "TOD-DONE01",
        token: "demo-done-job-kc",
        trade: "hvac",
        problem: "Replaced a failed blower motor in Brookside. Job complete.",
        urgency: "routine",
        street: "318 W 63rd St",
        city: "Kansas City",
        state: "MO",
        zip: "64113",
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerId: customer.id,
        contractorId: contractor.id,
        matchPreference: "SPECIFIC",
        status: "COMPLETED",
        quoteSummary: "TOD trip minimum $189.00",
        events: {
          create: [
            { status: "RECEIVED", note: "Seeded completed ticket" },
            { status: "COMPLETED", note: "Work finished" },
          ],
        },
        payments: {
          create: {
            publicId: "PAY-DONE01",
            customerId: customer.id,
            amountCents: 18900,
            type: "DEPOSIT",
            status: "PAID",
            note: "Seeded TOD trip minimum (paid)",
          },
        },
      },
    });
  }

  const claimExisting = await prisma.booking.findUnique({ where: { publicId: "TOD-CLAIM01" } });
  if (!claimExisting) {
    await prisma.booking.create({
      data: {
        publicId: "TOD-CLAIM01",
        token: "demo-claim-job-kc",
        trade: "electrical",
        problem: "Kitchen GFCI will not reset in a Midtown duplex. Booked before the portal had passwords.",
        urgency: "routine",
        street: "3121 Troost Ave",
        city: "Kansas City",
        state: "MO",
        zip: "64109",
        customerName: claimCustomer.name,
        customerPhone: claimCustomer.phone,
        customerEmail: claimCustomer.email,
        customerId: claimCustomer.id,
        quoteSummary: "Routine electrical visit",
        events: { create: { status: "RECEIVED", note: "Seeded claim-path ticket" } },
        payments: {
          create: {
            publicId: "PAY-CLAIM01",
            customerId: claimCustomer.id,
            amountCents: 14900,
            type: "DEPOSIT",
            status: "PENDING",
            note: "Seeded trip hold — pending with TOD",
          },
        },
      },
    });
  }

  const cancelledExisting = await prisma.booking.findUnique({ where: { publicId: "TOD-CXL01" } });
  if (!cancelledExisting) {
    await prisma.booking.create({
      data: {
        publicId: "TOD-CXL01",
        token: "demo-cancelled-job-kc",
        trade: "plumbing",
        problem: "Customer cancelled a routine drain visit before arrival.",
        urgency: "routine",
        street: "401 E 31st St",
        city: "Kansas City",
        state: "MO",
        zip: "64108",
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerId: customer.id,
        contractorId: contractor.id,
        matchPreference: "SPECIFIC",
        status: "CANCELLED",
        quoteSummary: "Cancelled before dispatch hold captured",
        events: {
          create: [
            { status: "RECEIVED", note: "Seeded cancelled ticket" },
            { status: "CANCELLED", note: "Customer cancelled" },
          ],
        },
        payments: {
          create: {
            publicId: "PAY-CXL01",
            customerId: customer.id,
            amountCents: 14900,
            type: "DEPOSIT",
            status: "REFUNDED",
            note: "Seeded deposit refunded by TOD",
          },
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
