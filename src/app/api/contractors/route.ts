import { NextResponse } from "next/server";
import {
  createContractorLoginToken,
  createContractorPublicId,
  createContractorSlug,
  toPublicContractor,
  validateContractorInput,
  type ContractorInput,
} from "@/lib/contractor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trade = new URL(request.url).searchParams.get("trade") ?? "";
  const rows = await prisma.contractor.findMany({
    where: { status: "APPROVED" },
    orderBy: { businessName: "asc" },
  });

  const contractors = rows
    .map(toPublicContractor)
    .filter((row) => !trade || row.trades.includes(trade));

  return NextResponse.json({ contractors });
}

export async function POST(request: Request) {
  let body: Partial<ContractorInput>;
  try {
    body = (await request.json()) as Partial<ContractorInput>;
  } catch {
    return NextResponse.json({ error: "Send a JSON application." }, { status: 400 });
  }

  const parsed = validateContractorInput({
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
    insuranceDetails: body.insuranceDetails ? String(body.insuranceDetails) : "",
    yearsExperience: body.yearsExperience ? String(body.yearsExperience) : "",
    bio: body.bio ? String(body.bio) : "",
    hourlyRate: String(body.hourlyRate ?? ""),
    minimumCharge: String(body.minimumCharge ?? ""),
    emergencyRate: body.emergencyRate ? String(body.emergencyRate) : "",
    tradeRates: Array.isArray(body.tradeRates)
      ? body.tradeRates.map((row) => ({
          slug: String(row.slug ?? ""),
          hourly: String(row.hourly ?? ""),
          minimum: String(row.minimum ?? ""),
        }))
      : [],
    agreedToTerms: Boolean(body.agreedToTerms),
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message, field: parsed.field }, { status: 400 });
  }

  const contractor = await prisma.contractor.create({
    data: {
      publicId: createContractorPublicId(),
      slug: createContractorSlug(parsed.data.businessName),
      businessName: parsed.data.businessName,
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      tradesJson: JSON.stringify(parsed.data.trades),
      licenseNumber: parsed.data.licenseNumber,
      licenseType: parsed.data.licenseType,
      licenseState: parsed.data.licenseState,
      serviceArea: parsed.data.serviceArea,
      insured: parsed.data.insured,
      insuranceDetails: parsed.data.insuranceDetails,
      yearsExperience: parsed.data.yearsExperience,
      bio: parsed.data.bio,
      hourlyRateCents: parsed.data.hourlyRateCents,
      minimumChargeCents: parsed.data.minimumChargeCents,
      emergencyRateCents: parsed.data.emergencyRateCents,
      tradeRatesJson: JSON.stringify(parsed.data.tradeRates),
      loginToken: createContractorLoginToken(),
      status: "PENDING",
    },
  });

  return NextResponse.json({
    publicId: contractor.publicId,
    slug: contractor.slug,
    status: contractor.status,
  });
}
