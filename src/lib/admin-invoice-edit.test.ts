import { describe, expect, it, vi } from "vitest";
import { applySavedInvoiceToDueRow, toAdminInvoiceDueRow } from "./admin-invoices-due";
import { saveAdminInvoice, type AdminInvoiceStore } from "./admin-invoice-edit";
import { outstandingCustomerJobPays } from "./customer-jobs";
import type { ExistingInvoiceRow } from "./invoice-persist";
import { applyPlatformMarkupCents, platformMarkupCents } from "./pricing";

const job = {
  id: "job_1",
  publicId: "TOD-DONE01",
  token: "demo-done-job-kc",
  status: "COMPLETED",
  customerId: "cus_1",
  contractorId: "pro_1",
  payments: [
    { id: "pay_dep", amountCents: 18900, status: "PAID", type: "DEPOSIT" },
    { id: "pay_bal", amountCents: 17500, status: "PENDING", type: "BALANCE" },
  ],
};

const sentInvoice: ExistingInvoiceRow = {
  id: "inv_1",
  publicId: "INV-DONE01",
  paymentId: "pay_bal",
  sentAt: new Date("2026-09-01T12:00:00Z"),
  paidAt: null,
  status: "SENT",
  payment: { id: "pay_bal", status: "PENDING", amountCents: 17500, type: "BALANCE" },
};

const savedInvoice = {
  id: "inv_1",
  publicId: "INV-DONE01",
  bookingId: "job_1",
  status: "SENT",
  note: "Admin correction",
  laborCents: 22000,
  materialsCents: 16900,
  subtotalCents: 38900,
  customerSubtotalCents: 46680,
  markupCents: 7780,
  depositPaidCents: 18900,
  amountDueCents: 20000,
  lines: [],
  payment: {
    id: "pay_bal",
    amountCents: 20000,
    status: "PENDING",
    type: "BALANCE",
    stripeCheckoutSessionId: null,
  },
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
        bookingPayments: job.payments,
        totals: expect.objectContaining({
          laborCents: 22000,
          materialsCents: 16900,
          discountCents: 0,
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

  it("applies a shop discount before markup when correcting lines", async () => {
    const persist = vi.fn(async () => savedInvoice as never);
    const result = await saveAdminInvoice(
      "job_1",
      {
        labor: [{ description: "HVAC labor", hours: "1.5", rate: "110" }],
        materials: [{ description: "Blower motor", cost: "169" }],
        discounts: [{ description: "Goodwill", amount: "50" }],
        note: "Corrected hours and shop discount",
      },
      store({ persist }),
    );
    expect(result.ok).toBe(true);
    const shopSubtotalCents = 16500 + 16900 - 5000;
    const customerSubtotalCents = applyPlatformMarkupCents(shopSubtotalCents);
    const amountDueCents = customerSubtotalCents - 18900;
    expect(shopSubtotalCents).toBe(28400);
    expect(customerSubtotalCents).toBe(34080);
    expect(amountDueCents).toBe(15180);
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: true,
        note: "Corrected hours and shop discount",
        lines: [
          {
            kind: "LABOR",
            description: "HVAC labor",
            quantity: "1.5",
            unitCents: 11000,
            amountCents: 16500,
          },
          {
            kind: "MATERIAL",
            description: "Blower motor",
            quantity: "1",
            unitCents: 16900,
            amountCents: 16900,
          },
          {
            kind: "DISCOUNT",
            description: "Goodwill",
            quantity: "1",
            unitCents: -5000,
            amountCents: -5000,
          },
        ],
        totals: expect.objectContaining({
          laborCents: 16500,
          materialsCents: 16900,
          discountCents: -5000,
          subtotalCents: shopSubtotalCents,
          customerSubtotalCents,
          markupCents: platformMarkupCents(shopSubtotalCents),
          depositPaidCents: 18900,
          amountDueCents,
        }),
      }),
    );
  });

  it("rejects a discount that exceeds shop labor and materials", async () => {
    const persist = vi.fn(async () => savedInvoice as never);
    const result = await saveAdminInvoice(
      "job_1",
      {
        labor: [{ hours: "1", rate: "100" }],
        discounts: [{ amount: "400" }],
      },
      store({ persist }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/cannot exceed the shop labor and materials/);
    expect(persist).not.toHaveBeenCalled();
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

  it("save → recompute → invoices due and customer pay show the new due", async () => {
    const persist = vi.fn(async (input: { totals: { amountDueCents: number; customerSubtotalCents: number; markupCents: number; subtotalCents: number; laborCents: number; materialsCents: number; depositPaidCents: number }; lines: unknown[]; note: string | null; publish: boolean }) => ({
      id: "inv_1",
      publicId: "INV-DONE01",
      bookingId: "job_1",
      status: input.publish ? "SENT" : "DRAFT",
      note: input.note,
      laborCents: input.totals.laborCents,
      materialsCents: input.totals.materialsCents,
      subtotalCents: input.totals.subtotalCents,
      customerSubtotalCents: input.totals.customerSubtotalCents,
      markupCents: input.totals.markupCents,
      depositPaidCents: input.totals.depositPaidCents,
      amountDueCents: input.totals.amountDueCents,
      lines: input.lines,
      payment: {
        id: "pay_bal",
        status: "PENDING",
        type: "BALANCE",
        amountCents: input.totals.amountDueCents,
        stripeCheckoutSessionId: null,
      },
    }));
    const result = await saveAdminInvoice(
      "job_1",
      {
        labor: [{ description: "HVAC labor", hours: "1.5", rate: "110" }],
        materials: [{ description: "Blower motor", cost: "169" }],
        discounts: [{ description: "Goodwill", amount: "50" }],
      },
      store({ persist: persist as never }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const shopSubtotalCents = 16500 + 16900 - 5000;
    const customerSubtotalCents = applyPlatformMarkupCents(shopSubtotalCents);
    const amountDueCents = customerSubtotalCents - 18900;
    expect(result.publicInvoice.amountDueCents).toBe(amountDueCents);
    expect(result.publicInvoice.payment?.amountCents).toBe(amountDueCents);
    expect(result.surfaces).toEqual({
      jobId: "job_1",
      jobPublicId: "TOD-DONE01",
      customerId: "cus_1",
      statusToken: "demo-done-job-kc",
    });

    const dueRow = toAdminInvoiceDueRow({
      id: result.publicInvoice.id,
      publicId: result.publicInvoice.publicId,
      status: result.publicInvoice.status,
      note: result.publicInvoice.note,
      laborCents: result.publicInvoice.laborCents,
      materialsCents: result.publicInvoice.materialsCents,
      subtotalCents: result.publicInvoice.subtotalCents,
      customerSubtotalCents: result.publicInvoice.customerSubtotalCents,
      markupCents: result.publicInvoice.markupCents,
      depositPaidCents: result.publicInvoice.depositPaidCents,
      amountDueCents: result.publicInvoice.amountDueCents,
      paymentId: result.publicInvoice.payment?.id,
      sentAt: sentInvoice.sentAt,
      createdAt: new Date("2026-09-01T12:00:00Z"),
      lines: result.publicInvoice.lines,
      booking: {
        id: job.id,
        publicId: job.publicId,
        customerName: "Alex Kim",
        customer: { id: "cus_1", name: "Alex Kim" },
        payments: [
          { id: "pay_dep", amountCents: 18900, status: "PAID" },
          { id: "pay_bal", amountCents: result.publicInvoice.payment?.amountCents ?? 0, status: "PENDING" },
        ],
      },
      payment: {
        status: "PENDING",
        type: "BALANCE",
        amountCents: result.publicInvoice.payment?.amountCents ?? 0,
      },
    });
    expect(dueRow?.amountDueCents).toBe(amountDueCents);
    expect(dueRow?.discountCents).toBe(-5000);

    const patched = applySavedInvoiceToDueRow(
      {
        invoiceId: "inv_1",
        invoicePublicId: "INV-DONE01",
        jobId: "job_1",
        jobPublicId: "TOD-DONE01",
        jobHref: "/admin/jobs/job_1#invoice",
        clientId: "cus_1",
        clientName: "Alex Kim",
        contractorId: "pro_1",
        contractorName: "Waldo Heat",
        status: "SENT",
        sentAt: sentInvoice.sentAt,
        createdAt: new Date("2026-09-01T12:00:00Z"),
        sentAtLabel: "Sep 1, 2026",
        amountDueCents: 17500,
        shopSubtotalCents: 36400,
        customerSubtotalCents: 43680,
        markupCents: 7280,
        discountCents: 0,
        hasMarkup: true,
        editor: {
          jobId: "job_1",
          depositPaidCents: 18900,
          invoice: {
            publicId: "INV-DONE01",
            status: "SENT",
            note: null,
            laborCents: 16500,
            materialsCents: 19900,
            subtotalCents: 36400,
            customerSubtotalCents: 43680,
            markupCents: 7280,
            depositPaidCents: 22680,
            amountDueCents: 21000,
            lines: [],
          },
        },
      },
      result.publicInvoice,
    );
    expect(patched?.amountDueCents).toBe(amountDueCents);
    expect(patched?.editor.invoice.amountDueCents).toBe(amountDueCents);

    expect(
      outstandingCustomerJobPays([
        {
          publicId: "TOD-DONE01",
          payments: [
            { id: "pay_bal", amountCents: result.publicInvoice.payment?.amountCents ?? 0, status: "PENDING", type: "BALANCE" },
          ],
        },
      ]),
    ).toEqual([
      {
        jobPublicId: "TOD-DONE01",
        payPath: "/account/jobs/TOD-DONE01",
        pendingCents: amountDueCents,
        payments: [
          { id: "pay_bal", amountCents: amountDueCents, status: "PENDING", type: "BALANCE" },
        ],
      },
    ]);
  });
});
