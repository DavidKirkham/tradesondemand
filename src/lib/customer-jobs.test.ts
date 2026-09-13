import { describe, expect, it } from "vitest";
import {
  customerPaymentLine,
  customerPaymentTotals,
  isPastCustomerJob,
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
