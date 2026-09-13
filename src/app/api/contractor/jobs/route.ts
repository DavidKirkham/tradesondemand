import { NextResponse } from "next/server";
import { jobFitsContractor } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  const [assignedRows, open] = await Promise.all([
    prisma.booking.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.findMany({
      where: {
        contractorId: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const available = open.filter((job) => jobFitsContractor(job, contractor));

  return NextResponse.json({
    assigned: assignedRows.map((job) => ({
      id: job.id,
      publicId: job.publicId,
      trade: job.trade,
      urgency: job.urgency,
      city: job.city,
      zip: job.zip,
      status: job.status,
    })),
    available: available.map((job) => ({
      id: job.id,
      publicId: job.publicId,
      trade: job.trade,
      urgency: job.urgency,
      city: job.city,
      zip: job.zip,
      status: job.status,
    })),
  });
}
