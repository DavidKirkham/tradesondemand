import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.upsert({
    where: { email: "riley@example.com" },
    update: {},
    create: {
      email: "riley@example.com",
      name: "Riley Chen",
      phone: "8165550144",
      token: "demo-customer-token-kc",
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

  const contractor = await prisma.contractor.upsert({
    where: { slug: "waldo-heat-demo" },
    update: { loginToken: "tod-waldo-demo" },
    create: {
      publicId: "PRO-DEMO01",
      slug: "waldo-heat-demo",
      businessName: "Waldo Heat & Pipe",
      contactName: "Morgan Ellis",
      phone: "8165160735",
      email: "morgan@waldoheat.example",
      loginToken: "tod-waldo-demo",
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
