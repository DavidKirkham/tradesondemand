import { NextResponse } from "next/server";
import { prismaFailureResponse } from "@/lib/api-errors";
import { getApprovedContractorFromCookie } from "@/lib/contractor-auth";
import {
  getVapidPublicKey,
  isMissingPushSubscriptionTable,
  isWebPushConfigured,
  validatePushSubscription,
} from "@/lib/contractor-push";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  const configured = isWebPushConfigured();
  try {
    const subscriptionCount = await prisma.contractorPushSubscription.count({
      where: { contractorId: contractor.id },
    });
    return NextResponse.json({
      configured,
      publicKey: configured ? getVapidPublicKey() : "",
      subscriptionCount,
    });
  } catch (error) {
    if (isMissingPushSubscriptionTable(error)) {
      return NextResponse.json({
        configured,
        publicKey: configured ? getVapidPublicKey() : "",
        subscriptionCount: 0,
        migrateRequired: true,
      });
    }
    return prismaFailureResponse(error, "Could not load push settings.");
  }
}

export async function POST(request: Request) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web Push is not configured on this server yet." },
      { status: 503 },
    );
  }

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const parsed = validatePushSubscription(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  try {
    const row = await prisma.contractorPushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      create: {
        contractorId: contractor.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent,
      },
      update: {
        contractorId: contractor.id,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent,
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (error) {
    return prismaFailureResponse(error, "Could not save the push subscription.");
  }
}

export async function DELETE(request: Request) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    return NextResponse.json({ error: "Sign in as an approved contractor." }, { status: 401 });
  }

  let body: { endpoint?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Push endpoint required." }, { status: 400 });
  }

  try {
    const existing = await prisma.contractorPushSubscription.findUnique({ where: { endpoint } });
    if (!existing || existing.contractorId !== contractor.id) {
      return NextResponse.json({ ok: true });
    }
    await prisma.contractorPushSubscription.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingPushSubscriptionTable(error)) {
      return NextResponse.json({ ok: true });
    }
    return prismaFailureResponse(error, "Could not remove the push subscription.");
  }
}
