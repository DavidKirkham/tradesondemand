import { NextResponse } from "next/server";
import { validateAdminBookingAddress } from "@/lib/admin";
import { deleteAdminJob } from "@/lib/admin-job-delete";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isBookingStatus } from "@/lib/booking";
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
    return NextResponse.json({ error: "Type the job ID to confirm deletion." }, { status: 400 });
  }

  try {
    const result = await deleteAdminJob(id, confirm);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.payments ? { payments: result.payments } : {}) },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, publicId: result.publicId });
  } catch (error) {
    return prismaFailureResponse(error, "Could not delete job.");
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
  let body: {
    status?: string;
    note?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    contractorId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const data: {
    status?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    contractorId?: string | null;
    matchPreference?: string;
    events?: { create: { status: string; note: string | null } };
  } = {};

  if (body.status !== undefined) {
    if (!isBookingStatus(body.status)) {
      return NextResponse.json({ error: "Unknown job status." }, { status: 400 });
    }
    data.status = body.status;
    data.events = { create: { status: body.status, note: body.note?.trim() || null } };
  }

  const address = validateAdminBookingAddress({
    street: body.street,
    city: body.city,
    state: body.state,
    zip: body.zip,
  });
  if (!address.ok) return NextResponse.json({ error: address.message }, { status: 400 });
  if (address.street) {
    data.street = address.street;
    data.city = address.city;
    data.state = address.state;
    data.zip = address.zip;
  }

  if (body.contractorId !== undefined) {
    data.contractorId = body.contractorId || null;
    data.matchPreference = body.contractorId ? "SPECIFIC" : "FIRST_AVAILABLE";
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const booking = await prisma.booking.update({
      where: { id },
      data,
    });
    return NextResponse.json({ booking });
  } catch {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
}
