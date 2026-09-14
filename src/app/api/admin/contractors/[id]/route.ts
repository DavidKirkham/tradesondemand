import { NextResponse } from "next/server";
import { validateAdminContractorPatch } from "@/lib/admin";
import { deleteAdminContractor } from "@/lib/admin-contractor-delete";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const { id } = await params;
  let confirm = "";
  try {
    const body = (await request.json()) as { confirm?: string };
    confirm = String(body.confirm ?? "");
  } catch {
    return NextResponse.json({ error: "Type the business name to confirm deletion." }, { status: 400 });
  }

  try {
    const result = await deleteAdminContractor(id, confirm);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.jobs ? { jobs: result.jobs } : {}) },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, businessName: result.businessName });
  } catch (error) {
    return prismaFailureResponse(error, "Could not delete subcontractor.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const parsed = validateAdminContractorPatch({
    businessName: String(body.businessName ?? ""),
    contactName: String(body.contactName ?? ""),
    phone: String(body.phone ?? ""),
    email: String(body.email ?? ""),
    trades: Array.isArray(body.trades) ? body.trades.map(String) : [],
    licenseNumber: String(body.licenseNumber ?? ""),
    licenseType: String(body.licenseType ?? ""),
    licenseState: String(body.licenseState ?? ""),
    serviceArea: String(body.serviceArea ?? ""),
    insured: Boolean(body.insured),
    insuranceDetails: body.insuranceDetails != null ? String(body.insuranceDetails) : "",
    yearsExperience: body.yearsExperience != null ? String(body.yearsExperience) : "",
    bio: body.bio != null ? String(body.bio) : "",
    hourlyRate: String(body.hourlyRate ?? ""),
    minimumCharge: String(body.minimumCharge ?? ""),
    emergencyRate: body.emergencyRate != null ? String(body.emergencyRate) : "",
    tradeRates: Array.isArray(body.tradeRates)
      ? body.tradeRates.map((row) => {
          const item = row as { slug?: string; hourly?: string; minimum?: string };
          return {
            slug: String(item.slug ?? ""),
            hourly: String(item.hourly ?? ""),
            minimum: String(item.minimum ?? ""),
          };
        })
      : [],
    status: body.status != null ? String(body.status) : undefined,
    reviewNote: body.reviewNote != null ? String(body.reviewNote) : null,
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { data } = parsed;
  try {
    const contractor = await prisma.contractor.update({
      where: { id },
      data: {
        businessName: data.businessName,
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        tradesJson: JSON.stringify(data.trades),
        licenseNumber: data.licenseNumber,
        licenseType: data.licenseType,
        licenseState: data.licenseState,
        serviceArea: data.serviceArea,
        insured: data.insured,
        insuranceDetails: data.insuranceDetails,
        yearsExperience: data.yearsExperience,
        bio: data.bio,
        hourlyRateCents: data.hourlyRateCents,
        minimumChargeCents: data.minimumChargeCents,
        emergencyRateCents: data.emergencyRateCents,
        tradeRatesJson: JSON.stringify(data.tradeRates),
        ...(data.status ? { status: data.status } : {}),
        reviewNote: data.reviewNote,
      },
    });
    return NextResponse.json({ contractor });
  } catch {
    return NextResponse.json({ error: "Subcontractor not found." }, { status: 404 });
  }
}
