import { describe, expect, it } from "vitest";
import {
  adminInvoiceDueHref,
  filterInvoicesDue,
  formatInvoiceDueDate,
  invoiceIsOutstandingDue,
  invoicesDueTotalCents,
  outstandingInvoicesDue,
  parseInvoiceDueSort,
  sortInvoicesDue,
  type InvoiceDueSource,
} from "./admin-invoices-due";

function invoice(overrides: Partial<InvoiceDueSource> = {}): InvoiceDueSource {
  return {
    id: "inv_1",
    publicId: "INV-DONE01",
    status: "SENT",
    laborCents: 16500,
    materialsCents: 19900,
    subtotalCents: 36400,
    customerSubtotalCents: 43680,
    markupCents: 7280,
    depositPaidCents: 22680,
    amountDueCents: 21000,
    sentAt: new Date("2026-09-01T17:00:00Z"),
    createdAt: new Date("2026-09-01T16:00:00Z"),
    booking: {
      id: "job_1",
      publicId: "TOD-DONE01",
      customerName: "Alex Kim",
      customer: { id: "cus_1", name: "Alex Kim" },
      contractor: { id: "con_1", businessName: "Waldo Heat" },
    },
    payment: { status: "PENDING", type: "BALANCE", amountCents: 21000 },
    ...overrides,
  };
}

describe("invoiceIsOutstandingDue", () => {
  it("includes sent and draft invoices with a customer balance", () => {
    expect(invoiceIsOutstandingDue(invoice())).toBe(true);
    expect(invoiceIsOutstandingDue(invoice({ status: "DRAFT", payment: null }))).toBe(true);
  });

  it("excludes fully paid invoices even if a pending row remains", () => {
    expect(invoiceIsOutstandingDue(invoice({ status: "PAID", amountDueCents: 0 }))).toBe(false);
    expect(
      invoiceIsOutstandingDue(
        invoice({
          status: "PAID",
          amountDueCents: 0,
          payment: { status: "PENDING", type: "BALANCE", amountCents: 21000 },
        }),
      ),
    ).toBe(false);
  });

  it("includes a zero-due invoice only when a pending balance payment remains", () => {
    expect(invoiceIsOutstandingDue(invoice({ amountDueCents: 0, payment: null }))).toBe(false);
    expect(
      invoiceIsOutstandingDue(
        invoice({
          amountDueCents: 0,
          payment: { status: "PENDING", type: "BALANCE", amountCents: 5000 },
        }),
      ),
    ).toBe(true);
    expect(
      invoiceIsOutstandingDue(
        invoice({
          amountDueCents: 0,
          payment: { status: "PENDING", type: "DEPOSIT", amountCents: 18900 },
        }),
      ),
    ).toBe(false);
  });
});

describe("outstandingInvoicesDue", () => {
  it("maps customer amounts, markup, and the job invoice deep-link", () => {
    const [row] = outstandingInvoicesDue([invoice()]);
    expect(row).toMatchObject({
      invoicePublicId: "INV-DONE01",
      jobPublicId: "TOD-DONE01",
      jobHref: "/admin/jobs/job_1#invoice",
      clientName: "Alex Kim",
      clientId: "cus_1",
      contractorName: "Waldo Heat",
      amountDueCents: 21000,
      shopSubtotalCents: 36400,
      customerSubtotalCents: 43680,
      markupCents: 7280,
      discountCents: 0,
      hasMarkup: true,
      status: "SENT",
      sentAtLabel: "Sep 1, 2026",
      editor: {
        jobId: "job_1",
        depositPaidCents: 22680,
        invoice: {
          publicId: "INV-DONE01",
          status: "SENT",
          amountDueCents: 21000,
          lines: [],
        },
      },
    });
    expect(adminInvoiceDueHref("job_1")).toBe("/admin/jobs/job_1#invoice");
  });

  it("embeds shop discount lines so the due list can open the editor in place", () => {
    const [row] = outstandingInvoicesDue([
      invoice({
        paymentId: "pay_bal",
        lines: [
          {
            kind: "LABOR",
            description: "HVAC labor",
            quantity: "2",
            unitCents: 11000,
            amountCents: 22000,
          },
          {
            kind: "DISCOUNT",
            description: "Goodwill",
            quantity: "1",
            unitCents: -5000,
            amountCents: -5000,
          },
        ],
        booking: {
          id: "job_1",
          publicId: "TOD-DONE01",
          customerName: "Alex Kim",
          customer: { id: "cus_1", name: "Alex Kim" },
          contractor: { id: "con_1", businessName: "Waldo Heat" },
          payments: [
            { id: "pay_dep", amountCents: 18900, status: "PAID" },
            { id: "pay_bal", amountCents: 21000, status: "PENDING" },
          ],
        },
      }),
    ]);
    expect(row.discountCents).toBe(-5000);
    expect(row.editor.depositPaidCents).toBe(18900);
    expect(row.editor.invoice.lines).toEqual([
      {
        kind: "LABOR",
        description: "HVAC labor",
        quantity: "2",
        unitCents: 11000,
        amountCents: 22000,
      },
      {
        kind: "DISCOUNT",
        description: "Goodwill",
        quantity: "1",
        unitCents: -5000,
        amountCents: -5000,
      },
    ]);
  });

  it("falls back to the booking customer name and skips paid invoices", () => {
    const rows = outstandingInvoicesDue([
      invoice({
        id: "inv_paid",
        publicId: "INV-PAID01",
        status: "PAID",
        amountDueCents: 0,
        payment: { status: "PAID", type: "BALANCE", amountCents: 21000 },
      }),
      invoice({
        id: "inv_walkin",
        publicId: "INV-WALK01",
        booking: {
          id: "job_2",
          publicId: "TOD-WALK01",
          customerName: "Jordan Lee",
          customer: null,
          contractor: null,
        },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      jobPublicId: "TOD-WALK01",
      clientName: "Jordan Lee",
      clientId: null,
      contractorName: null,
    });
  });

  it("defaults to oldest sent first, then highest amount", () => {
    const rows = outstandingInvoicesDue([
      invoice({
        id: "newer",
        publicId: "INV-NEW01",
        amountDueCents: 40000,
        sentAt: new Date("2026-09-10T12:00:00Z"),
        createdAt: new Date("2026-09-10T12:00:00Z"),
        booking: { id: "job_new", publicId: "TOD-NEW01", customerName: "Newer" },
      }),
      invoice({
        id: "older",
        publicId: "INV-OLD01",
        amountDueCents: 10000,
        sentAt: new Date("2026-08-01T12:00:00Z"),
        createdAt: new Date("2026-08-01T12:00:00Z"),
        booking: { id: "job_old", publicId: "TOD-OLD01", customerName: "Older" },
      }),
    ]);
    expect(rows.map((row) => row.invoicePublicId)).toEqual(["INV-OLD01", "INV-NEW01"]);
    expect(sortInvoicesDue(rows, "amount").map((row) => row.invoicePublicId)).toEqual([
      "INV-NEW01",
      "INV-OLD01",
    ]);
  });

  it("returns an empty list when nothing is owed", () => {
    expect(outstandingInvoicesDue([])).toEqual([]);
    expect(
      outstandingInvoicesDue([
        invoice({ status: "PAID", amountDueCents: 0, payment: { status: "PAID", type: "BALANCE", amountCents: 1 } }),
      ]),
    ).toEqual([]);
  });
});

describe("filterInvoicesDue and totals", () => {
  const rows = outstandingInvoicesDue([
    invoice(),
    invoice({
      id: "inv_2",
      publicId: "INV-PLUMB1",
      booking: {
        id: "job_2",
        publicId: "TOD-PLUMB1",
        customerName: "Sam Rivera",
        customer: { id: "cus_2", name: "Sam Rivera" },
        contractor: { id: "con_2", businessName: "Northland Plumbing" },
      },
    }),
  ]);

  it("filters by job, invoice, client, or shop", () => {
    expect(filterInvoicesDue(rows, "tod-done").map((row) => row.jobPublicId)).toEqual(["TOD-DONE01"]);
    expect(filterInvoicesDue(rows, "INV-PLUMB").map((row) => row.invoicePublicId)).toEqual(["INV-PLUMB1"]);
    expect(filterInvoicesDue(rows, "sam").map((row) => row.clientName)).toEqual(["Sam Rivera"]);
    expect(filterInvoicesDue(rows, "northland").map((row) => row.contractorName)).toEqual([
      "Northland Plumbing",
    ]);
    expect(filterInvoicesDue(rows, "nope")).toEqual([]);
  });

  it("sums customer amounts owed", () => {
    expect(invoicesDueTotalCents(rows)).toBe(42000);
    expect(invoicesDueTotalCents([])).toBe(0);
  });
});

describe("parseInvoiceDueSort and dates", () => {
  it("treats unknown sort as oldest first", () => {
    expect(parseInvoiceDueSort("amount")).toBe("amount");
    expect(parseInvoiceDueSort("oldest")).toBe("oldest");
    expect(parseInvoiceDueSort(undefined)).toBe("oldest");
    expect(parseInvoiceDueSort("nope")).toBe("oldest");
  });

  it("formats sent dates in KC time and labels drafts", () => {
    expect(formatInvoiceDueDate(null)).toBe("Not sent");
    expect(formatInvoiceDueDate(new Date("2026-09-01T17:00:00Z"))).toBe("Sep 1, 2026");
  });
});
