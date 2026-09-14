import { Prisma } from "@prisma/client";
import { isPastContractorJob, PAST_JOB_STATUSES } from "./contractor-app";
import { isMissingInvoiceModel } from "./invoice-columns";
import { prisma } from "./prisma";

export type ContractorDeleteJob = {
  id: string;
  publicId: string;
  status: string;
};

export type ContractorDeleteRecord = {
  id: string;
  businessName: string;
  bookings: ContractorDeleteJob[];
};

export type DeleteContractorStore = {
  findContractor: (id: string) => Promise<ContractorDeleteRecord | null>;
  unassignClosedJobsAndDelete: (id: string) => Promise<void>;
};

export type DeleteContractorResult =
  | { ok: true; businessName: string }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string; jobs?: ContractorDeleteJob[] };

export function confirmMatchesBusinessName(confirm: string, businessName: string): boolean {
  return confirm.trim().toLowerCase() === businessName.trim().toLowerCase();
}

export function blockingContractorJobs(bookings: ContractorDeleteJob[]): ContractorDeleteJob[] {
  return bookings.filter((job) => !isPastContractorJob(job.status));
}

export function contractorDeleteBlockedMessage(jobs: ContractorDeleteJob[]): string {
  const count = jobs.length;
  const noun = count === 1 ? "job is" : "jobs are";
  return `Cannot delete while ${count} ${noun} still active. Reassign, complete, or cancel them first.`;
}

export function defaultDeleteContractorStore(): DeleteContractorStore {
  return {
    async findContractor(id) {
      return prisma.contractor.findUnique({
        where: { id },
        select: {
          id: true,
          businessName: true,
          bookings: { select: { id: true, publicId: true, status: true } },
        },
      });
    },
    async unassignClosedJobsAndDelete(id) {
      await prisma.$transaction(async (tx) => {
        const latest = await tx.contractor.findUnique({
          where: { id },
          select: {
            id: true,
            bookings: { select: { id: true, publicId: true, status: true } },
          },
        });
        if (!latest) {
          throw new ContractorDeleteConflict("Subcontractor not found.", 404);
        }
        const blocking = blockingContractorJobs(latest.bookings);
        if (blocking.length > 0) {
          throw new ContractorDeleteConflict(contractorDeleteBlockedMessage(blocking), 409, blocking);
        }
        await tx.booking.updateMany({
          where: { contractorId: id, status: { in: [...PAST_JOB_STATUSES] } },
          data: { contractorId: null },
        });
        try {
          await tx.invoice.updateMany({
            where: { contractorId: id },
            data: { contractorId: null },
          });
        } catch (error) {
          if (!isMissingInvoiceModel(error)) throw error;
        }
        await tx.contractor.delete({ where: { id } });
      });
    },
  };
}

class ContractorDeleteConflict extends Error {
  status: 404 | 409;
  jobs?: ContractorDeleteJob[];

  constructor(message: string, status: 404 | 409, jobs?: ContractorDeleteJob[]) {
    super(message);
    this.name = "ContractorDeleteConflict";
    this.status = status;
    this.jobs = jobs;
  }
}

/**
 * Permanently remove a subcontractor.
 *
 * Booking rule: open jobs (not completed/cancelled) block delete so active
 * or unpaid work is not silently unassigned. Completed and cancelled jobs
 * stay on the books with contractorId set to null. Time & materials invoices
 * stay on those jobs with Invoice.contractorId set to null (same history
 * rule; the FK is ON DELETE SET NULL). ContractorPayout rows stay on those
 * jobs with contractorId SET NULL. Password-reset rows and Web Push
 * subscriptions cascade from Prisma. Payments stay on the booking.
 */
export async function deleteAdminContractor(
  id: string,
  confirm: string,
  store: DeleteContractorStore = defaultDeleteContractorStore(),
): Promise<DeleteContractorResult> {
  const contractor = await store.findContractor(id);
  if (!contractor) {
    return { ok: false, status: 404, error: "Subcontractor not found." };
  }
  if (!confirmMatchesBusinessName(confirm, contractor.businessName)) {
    return { ok: false, status: 400, error: "Type the business name to confirm deletion." };
  }

  const blocking = blockingContractorJobs(contractor.bookings);
  if (blocking.length > 0) {
    return {
      ok: false,
      status: 409,
      error: contractorDeleteBlockedMessage(blocking),
      jobs: blocking,
    };
  }

  try {
    await store.unassignClosedJobsAndDelete(contractor.id);
    return { ok: true, businessName: contractor.businessName };
  } catch (error) {
    if (error instanceof ContractorDeleteConflict) {
      return { ok: false, status: error.status, error: error.message, jobs: error.jobs };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        ok: false,
        status: 409,
        error: "Cannot delete while jobs still reference this shop. Reassign, complete, or cancel them first.",
      };
    }
    throw error;
  }
}
