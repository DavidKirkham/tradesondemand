import { describe, expect, it, vi } from "vitest";
import { saveAdminInvoice, type AdminInvoiceStore } from "./admin-invoice-edit";
import type { ExistingInvoiceRow } from "./invoice-persist";
import { applyPlatformMarkupCents, platformMarkupCents } from "./pricing";

const job = {
  id: "job_1",
  publicId: "TOD-DONE01",
  status: "COMPLETED",
  customerId: "cus_1",
  contractorId: "pro_1",
  payments: [
    { id: "pay_dep", amountCents: 18900, status: "PAID" },
    { id: "pay_bal", amountCents: 17500, status: "PENDING" },
  ],
};

const sentInvoice: ExistingInvoiceRow = {
  id: "inv_1",
  publicId: "INV-DONE01",
  paymentId: "pay_bal",
  sentAt: new Date("2026-09-01T12:00:00Z"),
  paidAt: null,
  status: "SENT",
  payment: { id: "pay_bal", status: "PENDING", amountCents: 17500 },
};

const savedInvoice = {
  id: "inv_1",
  publicId: "INV-DONE01",
  amountDueCents: 20000,
  lines: [],
  payment: { id: "pay_bal", amountCents: 20000, status: "PENDING" },
};

function store(overrides: Partial<AdminInvoiceStore> = {}): AdminInvoiceStore {
  return {
    findJob: vi.fn(async () => job),
    findInvoice: vi.fn(async () => sentInvoice),
    persist: vi.fn(async () => savedInvoice as never),
    ...overrides,
  };
}

const validBody = {
  labor: [{ description: "HVAC labor", hours: "2", rate: "110" }],
  materials: [{ description: "Blower motor", cost: "169" }],
  note: "Admin correction",
};

describe("saveAdminInvoice", () => {
  it("rejects unknown jobs and jobs without an invoice", async () => {
    expect(await saveAdminInvoice("missing", validBody, store({ findJob: async () => null }))).toEqual({
      ok: false,
      status: 404,
      error: "Job not found.",
    });
    expect(
      await saveAdminInvoice("job_1", validBody, store({ findInvoice: async () => null })),
    ).toEqual({
      ok: false,
      status: 404,
      error: "This job does not have an invoice yet.",
    });
  });

  it("blocks paid invoices so Stripe totals cannot be rewritten", async () => {
    const result = await saveAdminInvoice(
      "job_1",
      validBody,
      store({
        findInvoice: async () => ({
          ...sentInvoice,
          status: "PAID",
          paidAt: new Date("2026-09-02T12:00:00Z"),
          payment: { id: "pay_bal", status: "PAID", amountCents: 17500 },
        }),
      }),
    );
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "This invoice is already paid to TOD.",
    });
  });

  it("rejects invalid line items before writing", async () => {
    const persist = vi.fn(async () => savedInvoice as never);
    const result = await saveAdminInvoice(
      "job_1",
      { labor: [{ hours: "2", rate: "" }], materials: [] },
      store({ persist }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/hours and an hourly rate/);
    expect(persist).not.toHaveBeenCalled();
  });

  it("recomputes amount due and republishes a sent invoice", async () => {
    const persist = vi.fn(async () => savedInvoice as never);
    const result = await saveAdminInvoice("job_1", validBody, store({ persist }));
    expect(result.ok).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    const shopSubtotalCents = 22000 + 16900;
    const customerSubtotalCents = applyPlatformMarkupCents(shopSubtotalCents);
    const amountDueCents = customerSubtotalCents - 18900;
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: true,
        note: "Admin correction",
        eventNote: expect.stringMatching(/INV-DONE01.*\$277\.80/),
        totals: expect.objectContaining({
          laborCents: 22000,
          materialsCents: 16900,
          subtotalCents: shopSubtotalCents,
          customerSubtotalCents,
          markupCents: platformMarkupCents(shopSubtotalCents),
          depositPaidCents: 18900,
          amountDueCents,
        }),
      }),
    );
    expect(amountDueCents).toBe(27780);
    expect(customerSubtotalCents).toBe(46680);
  });

  it("keeps drafts unpublished so customers do not see them yet", async () => {
    const persist = vi.fn(async () => savedInvoice as never);
    await saveAdminInvoice(
      "job_1",
      validBody,
      store({
        persist,
        findInvoice: async () => ({ ...sentInvoice, status: "DRAFT", sentAt: null, payment: null }),
      }),
    );
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ publish: false }));
  });
});
