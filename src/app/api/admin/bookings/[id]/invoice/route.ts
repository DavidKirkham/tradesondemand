import { NextResponse } from "next/server";
import { saveAdminInvoice } from "@/lib/admin-invoice-edit";
import { prismaFailureResponse } from "@/lib/api-errors";
import { isMissingInvoiceMarkupColumn, isMissingInvoiceModel } from "@/lib/invoice-columns";
import { revalidateInvoiceSurfaces } from "@/lib/invoice-revalidate";
import { isOpsAuthenticated } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isOpsAuthenticated())) {
    return NextResponse.json({ error: "Sign in to admin." }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    labor?: { description?: string; hours?: string; rate?: string }[];
    materials?: { description?: string; cost?: string }[];
    discounts?: { description?: string; amount?: string }[];
    note?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  try {
    const result = await saveAdminInvoice(id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    revalidateInvoiceSurfaces(result.surfaces);
    return NextResponse.json({ invoice: result.publicInvoice });
  } catch (error) {
    if (isMissingInvoiceMarkupColumn(error)) {
      return prismaFailureResponse(error, "Could not save that invoice. Try again.");
    }
    if (isMissingInvoiceModel(error)) {
      return prismaFailureResponse(error, "Could not save that invoice. Try again.");
    }
    return prismaFailureResponse(error, "Could not save that invoice. Try again.");
  }
}
