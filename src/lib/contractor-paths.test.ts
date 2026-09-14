import { describe, expect, it } from "vitest";
import { contractorJobPath, contractorLoginHref, isSafeContractorNextPath } from "./contractor-paths";

describe("contractorJobPath", () => {
  it("deep-links to the job and stays a safe post-login return path", () => {
    expect(contractorJobPath("job_cuid_abc")).toBe("/contractor/jobs/job_cuid_abc");
    expect(isSafeContractorNextPath("/contractor/jobs/job_cuid_abc")).toBe(true);
    expect(contractorLoginHref("/contractor/jobs/job_cuid_abc")).toContain(
      encodeURIComponent("/contractor/jobs/job_cuid_abc"),
    );
  });
});
