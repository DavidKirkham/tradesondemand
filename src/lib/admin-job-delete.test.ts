import { describe, expect, it, vi } from "vitest";
import {
  blockingJobPayments,
  confirmMatchesJobId,
  deleteAdminJob,
  isOpenStripeCheckout,
  isPaidInvoice,
  jobDeleteBlockedMessage,
  type DeleteJobStore,
  type JobDeletePayment,
} from "./admin-job-delete";

const paid: JobDeletePayment = {
  id: "pay_paid",
  publicId: "PAY-PAID01",
  status: "PAID",
  type: "DEPOSIT",
  amountCents: 8900,
  stripeCheckoutSessionId: "cs_paid",
};

const openCheckout: JobDeletePayment = {
  id: "pay_open",
  publicId: "PAY-OPEN01",
  status: "PENDING",
  type: "DEPOSIT",
  amountCents: 8900,
  stripeCheckoutSessionId: "cs_open",
};

const pendingNoSession: JobDeletePayment = {
  id: "pay_pending",
  publicId: "PAY-PEND01",
  status: "PENDING",
  type: "DEPOSIT",
  amountCents: 8900,
  stripeCheckoutSessionId: null,
};

const refunded: JobDeletePayment = {
  id: "pay_ref",
  publicId: "PAY-REF01",
  status: "REFUNDED",
  type: "DEPOSIT",
  amountCents: 8900,
  stripeCheckoutSessionId: "cs_ref",
};

const job = {
  id: "job_1",
  publicId: "TOD-ABC123",
  status: "RECEIVED",
  payments: [] as JobDeletePayment[],
};

function store(overrides: Partial<DeleteJobStore> = {}): DeleteJobStore {
  return {
    findJob: vi.fn(async () => job),
    deleteJob: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("confirmMatchesJobId", () => {
  it("matches trimmed case-insensitive public IDs", () => {
    expect(confirmMatchesJobId("  tod-abc123 ", "TOD-ABC123")).toBe(true);
    expect(confirmMatchesJobId("TOD-ABC12", "TOD-ABC123")).toBe(false);
    expect(confirmMatchesJobId("", "TOD-ABC123")).toBe(false);
  });
});

describe("blockingJobPayments", () => {
  it("blocks paid invoices and open Stripe checkouts", () => {
    expect(isPaidInvoice(paid)).toBe(true);
    expect(isOpenStripeCheckout(openCheckout)).toBe(true);
    expect(isOpenStripeCheckout(pendingNoSession)).toBe(false);
    expect(isPaidInvoice(refunded)).toBe(false);

    const blocked = blockingJobPayments([paid, openCheckout, pendingNoSession, refunded]);
    expect(blocked.map((payment) => payment.publicId)).toEqual(["PAY-PAID01", "PAY-OPEN01"]);
    expect(jobDeleteBlockedMessage([paid, openCheckout])).toMatch(/paid invoices or an open Stripe checkout/);
    expect(jobDeleteBlockedMessage([paid])).toMatch(/1 paid invoice is/);
    expect(jobDeleteBlockedMessage([openCheckout])).toMatch(/1 open Stripe checkout is/);
  });
});

describe("deleteAdminJob", () => {
  it("deletes after typed job ID when payments are safe to cascade", async () => {
    const closed = {
      ...job,
      payments: [pendingNoSession, refunded],
    };
    const db = store({ findJob: vi.fn(async () => closed) });
    const result = await deleteAdminJob(job.id, "TOD-ABC123", db);
    expect(result).toEqual({ ok: true, publicId: "TOD-ABC123" });
    expect(db.deleteJob).toHaveBeenCalledWith(job.id);
  });

  it("rejects a missing job", async () => {
    const db = store({ findJob: async () => null });
    const result = await deleteAdminJob("missing", "TOD-ABC123", db);
    expect(result).toEqual({ ok: false, status: 404, error: "Job not found." });
    expect(db.deleteJob).not.toHaveBeenCalled();
  });

  it("rejects a confirm that does not match the public job ID", async () => {
    const db = store();
    const result = await deleteAdminJob(job.id, "TOD-WRONG", db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(db.deleteJob).not.toHaveBeenCalled();
  });

  it("blocks delete when a paid invoice remains", async () => {
    const db = store({
      findJob: async () => ({ ...job, payments: [paid] }),
    });
    const result = await deleteAdminJob(job.id, "TOD-ABC123", db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/paid invoice/);
      expect(result.payments?.[0].publicId).toBe("PAY-PAID01");
    }
    expect(db.deleteJob).not.toHaveBeenCalled();
  });

  it("blocks delete when a Stripe checkout session is still open", async () => {
    const db = store({
      findJob: async () => ({ ...job, payments: [openCheckout] }),
    });
    const result = await deleteAdminJob(job.id, "tod-abc123", db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/Stripe checkout/);
      expect(result.payments?.[0].stripeCheckoutSessionId).toBe("cs_open");
    }
    expect(db.deleteJob).not.toHaveBeenCalled();
  });
});
