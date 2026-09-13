import { NextResponse } from "next/server";
import { validateAdminCustomerPatch } from "@/lib/admin";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const { id } = await params;
  let body: { name?: string; email?: string; phone?: string; preferredContact?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const parsed = validateAdminCustomerPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  if (parsed.data.email) {
    const taken = await prisma.customer.findFirst({
      where: { email: parsed.data.email, NOT: { id } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Another client already uses that email." }, { status: 409 });
    }
  }

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.email ? { email: parsed.data.email } : {}),
          ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
          ...(parsed.data.preferredContact ? { preferredContact: parsed.data.preferredContact } : {}),
        },
      });
      await tx.booking.updateMany({
        where: { customerId: id },
        data: {
          ...(parsed.data.name ? { customerName: parsed.data.name } : {}),
          ...(parsed.data.email ? { customerEmail: parsed.data.email } : {}),
          ...(parsed.data.phone ? { customerPhone: parsed.data.phone } : {}),
        },
      });
      return updated;
    });
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }
}
