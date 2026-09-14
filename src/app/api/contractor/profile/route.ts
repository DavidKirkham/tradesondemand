import { NextResponse } from "next/server";
import { parseContractorTrades, validateContractorProfilePatch } from "@/lib/contractor-app";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  let body: {
    bio?: string;
    serviceArea?: string;
    hourlyRate?: string;
    minimumCharge?: string;
    emergencyRate?: string;
    yearsExperience?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    tradeRates?: { slug?: string; hourly?: string; minimum?: string }[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const parsed = validateContractorProfilePatch(
    {
      bio: body.bio,
      serviceArea: body.serviceArea,
      hourlyRate: body.hourlyRate,
      minimumCharge: body.minimumCharge,
      emergencyRate: body.emergencyRate,
      yearsExperience: body.yearsExperience,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email,
      tradeRates: Array.isArray(body.tradeRates)
        ? body.tradeRates.map((row) => ({
            slug: String(row.slug ?? ""),
            hourly: String(row.hourly ?? ""),
            minimum: String(row.minimum ?? ""),
          }))
        : [],
    },
    parseContractorTrades(contractor.tradesJson),
  );
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const updated = await prisma.contractor.update({
    where: { id: contractor.id },
    data: {
      bio: parsed.data.bio,
      serviceArea: parsed.data.serviceArea,
      hourlyRateCents: parsed.data.hourlyRateCents,
      minimumChargeCents: parsed.data.minimumChargeCents,
      emergencyRateCents: parsed.data.emergencyRateCents,
      yearsExperience: parsed.data.yearsExperience,
      tradeRatesJson: JSON.stringify(parsed.data.tradeRates),
      ...(parsed.data.contact
        ? {
            contactName: parsed.data.contact.contactName,
            phone: parsed.data.contact.phone,
            email: parsed.data.contact.email,
          }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, publicId: updated.publicId });
}
