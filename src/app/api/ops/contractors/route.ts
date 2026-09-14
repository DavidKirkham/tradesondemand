import { NextResponse } from "next/server";
import { toPublicContractor } from "@/lib/contractor";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to the ops board." }, { status: 401 });
  }

  const rows = await prisma.contractor.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    contractors: rows.map((row) => ({
      ...toPublicContractor(row),
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      insuranceDetails: row.insuranceDetails,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
