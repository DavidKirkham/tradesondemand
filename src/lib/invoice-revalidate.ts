import { revalidatePath } from "next/cache";

export type InvoiceRevalidateSurfaces = {
  jobId: string;
  jobPublicId: string;
  customerId?: string | null;
  statusToken?: string | null;
};

export function invoiceRevalidatePaths(input: InvoiceRevalidateSurfaces): {
  path: string;
  type?: "layout" | "page";
}[] {
  const paths: { path: string; type?: "layout" | "page" }[] = [
    { path: "/admin", type: "layout" },
    { path: "/account", type: "layout" },
    { path: "/contractor", type: "layout" },
    { path: "/admin/invoices" },
    { path: "/admin/jobs" },
    { path: `/admin/jobs/${input.jobId}` },
    { path: `/account/jobs/${encodeURIComponent(input.jobPublicId)}` },
  ];
  if (input.customerId) paths.push({ path: `/admin/clients/${input.customerId}` });
  if (input.statusToken) paths.push({ path: `/status/${input.statusToken}` });
  return paths;
}

/** Bust RSC + client router cache for every surface that shows customer due. */
export function revalidateInvoiceSurfaces(input: InvoiceRevalidateSurfaces) {
  for (const entry of invoiceRevalidatePaths(input)) {
    if (entry.type) revalidatePath(entry.path, entry.type);
    else revalidatePath(entry.path);
  }
}
