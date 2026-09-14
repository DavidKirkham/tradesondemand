import { describe, expect, it } from "vitest";
import { invoiceRevalidatePaths } from "./invoice-revalidate";

describe("invoiceRevalidatePaths", () => {
  it("covers admin due list, job detail, and customer pay surfaces", () => {
    const paths = invoiceRevalidatePaths({
      jobId: "job_1",
      jobPublicId: "TOD-DONE01",
      customerId: "cus_1",
      statusToken: "demo-done-job-kc",
    }).map((entry) => entry.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/admin",
        "/account",
        "/admin/invoices",
        "/admin/jobs",
        "/admin/jobs/job_1",
        "/account/jobs/TOD-DONE01",
        "/admin/clients/cus_1",
        "/status/demo-done-job-kc",
      ]),
    );
  });
});
