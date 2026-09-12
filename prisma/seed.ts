import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.booking.count();
  if (existing > 0) return;

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

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
