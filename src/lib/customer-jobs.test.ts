import { describe, expect, it } from "vitest";
import { customerLoginHref, isSafeAccountNextPath } from "./customer-paths";
import {
  customerJobPayPath,
  customerJobPayUrl,
  customerPaymentLine,
  customerPaymentTotals,
  isPastCustomerJob,
  outstandingCustomerJobPays,
  partitionCustomerJobs,
  payableCustomerPayments,
  pickPayablePayment,
} from "./customer-jobs";

describe("customer job lists", () => {
  it("splits current work from completed and cancelled jobs", () => {
    expect(isPastCustomerJob("RECEIVED")).toBe(false);
    expect(isPastCustomerJob("DISPATCHED")).toBe(false);
    expect(isPastCustomerJob("COMPLETED")).toBe(true);
    expect(isPastCustomerJob("CANCELLED")).toBe(true);
    const { current, past } = partitionCustomerJobs([
      { id: "1", status: "RECEIVED" },
      { id: "2", status: "ON_SITE" },
      { id: "3", status: "COMPLETED" },
      { id: "4", status: "CANCELLED" },
    ]);
    expect(current.map((job) => job.id)).toEqual(["1", "2"]);
    expect(past.map((job) => job.id)).toEqual(["3", "4"]);
  });
});

describe("customer payment totals", () => {
  it("sums pending, paid, and refunded amounts", () => {
    expect(customerPaymentTotals([])).toEqual({
      pendingCents: 0,
      paidCents: 0,
      refundedCents: 0,
      count: 0,
    });
    expect(
      customerPaymentTotals([
        { amountCents: 17500, status: "PENDING" },
        { amountCents: 18900, status: "PAID" },
        { amountCents: 14900, status: "REFUNDED" },
        { amountCents: 8000, status: "PENDING" },
      ]),
    ).toEqual({
      pendingCents: 25500,
      paidCents: 18900,
      refundedCents: 14900,
      count: 4,
    });
  });

  it("lists only positive pending charges as payable", () => {
    const payments = [
      { id: "a", amountCents: 17500, status: "PENDING", type: "DEPOSIT" },
      { id: "b", amountCents: 0, status: "PENDING", type: "DEPOSIT" },
      { id: "c", amountCents: 18900, status: "PAID", type: "DEPOSIT" },
      { id: "d", amountCents: 5000, status: "PENDING", type: "BALANCE" },
    ];
    expect(payableCustomerPayments(payments).map((row) => row.id)).toEqual(["a", "d"]);
    expect(pickPayablePayment(payments)?.id).toBe("a");
    expect(pickPayablePayment(payments, "d")?.id).toBe("d");
    expect(pickPayablePayment(payments, "c")).toBeNull();
    expect(customerPaymentLine(payments[0])).toMatch(/TOD deposit/);
    expect(customerPaymentLine(payments[0])).toMatch(/Pending/);
  });
});

describe("customer job pay links", () => {
  it("builds the existing account Checkout job path", () => {
    expect(customerJobPayPath("TOD-DEMO01")).toBe("/account/jobs/TOD-DEMO01");
    expect(customerJobPayPath("")).toBe("/account");
    expect(customerJobPayUrl("https://todkc.com/", "TOD-DONE01")).toBe(
      "https://todkc.com/account/jobs/TOD-DONE01",
    );
    expect(isSafeAccountNextPath(customerJobPayPath("TOD-DEMO01"))).toBe(true);
    expect(customerLoginHref(customerJobPayPath("TOD-DEMO01"))).toBe(
      "/account/login?next=%2Faccount%2Fjobs%2FTOD-DEMO01",
    );
  });

  it("lists only jobs with unpaid TOD deposits or balances", () => {
    const rows = outstandingCustomerJobPays([
      {
        publicId: "TOD-DEMO01",
        payments: [
          { id: "dep", amountCents: 17500, status: "PENDING", type: "DEPOSIT" },
          { id: "zero", amountCents: 0, status: "PENDING", type: "DEPOSIT" },
        ],
      },
      {
        publicId: "TOD-PAID01",
        payments: [{ id: "paid", amountCents: 18900, status: "PAID", type: "DEPOSIT" }],
      },
      {
        publicId: "TOD-DONE01",
        payments: [{ id: "bal", amountCents: 5000, status: "PENDING", type: "BALANCE" }],
      },
    ]);
    expect(rows.map((row) => row.jobPublicId)).toEqual(["TOD-DEMO01", "TOD-DONE01"]);
    expect(rows[0]).toMatchObject({
      payPath: "/account/jobs/TOD-DEMO01",
      pendingCents: 17500,
    });
    expect(rows[0].payments.map((payment) => payment.id)).toEqual(["dep"]);
    expect(rows[1].pendingCents).toBe(5000);
    expect(outstandingCustomerJobPays([])).toEqual([]);
  });
});
