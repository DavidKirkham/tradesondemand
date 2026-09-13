import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
        customerName: "Riley Chen",
        customerPhone: "8165550144",
        customerEmail: "riley@example.com",
        quoteSummary: "Emergency hvac dispatch · $89–$149 dispatch hold",
        events: {
          create: { status: "RECEIVED", note: "Seeded demo ticket" },
        },
      },
    });
  }

  await prisma.contractor.upsert({
    where: { slug: "waldo-heat-demo" },
    update: {},
    create: {
      publicId: "PRO-DEMO01",
      slug: "waldo-heat-demo",
      businessName: "Waldo Heat & Pipe",
      contactName: "Morgan Ellis",
      phone: "8165160735",
      email: "morgan@waldoheat.example",
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
