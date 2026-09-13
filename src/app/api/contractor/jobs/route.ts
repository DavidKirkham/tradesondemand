import { NextResponse } from "next/server";
import { BOOKING_SMS_OMIT } from "@/lib/booking-sms-columns";
import { isOpenContractorJob, jobFitsContractor } from "@/lib/contractor-app";
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
      omit: BOOKING_SMS_OMIT,
    }),
    prisma.booking.findMany({
      where: {
        contractorId: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      omit: BOOKING_SMS_OMIT,
    }),
  ]);

  const available = open.filter((job) => jobFitsContractor(job, contractor));
  const assigned = assignedRows.filter((job) => isOpenContractorJob(job.status));
  const past = assignedRows.filter((job) => !isOpenContractorJob(job.status));

  function preview(job: (typeof assignedRows)[number]) {
    return {
      id: job.id,
      publicId: job.publicId,
      trade: job.trade,
      urgency: job.urgency,
      city: job.city,
      zip: job.zip,
      status: job.status,
    };
  }

  return NextResponse.json({
    assigned: assigned.map(preview),
    available: available.map(preview),
    past: past.map(preview),
  });
}
