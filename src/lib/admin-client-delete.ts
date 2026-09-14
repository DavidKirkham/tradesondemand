import { Prisma } from "@prisma/client";
import { isPastContractorJob, PAST_JOB_STATUSES } from "./contractor-app";
import { prisma } from "./prisma";

export type ClientDeleteJob = {
  id: string;
  publicId: string;
  status: string;
};

export type ClientDeleteRecord = {
  id: string;
  name: string;
  bookings: ClientDeleteJob[];
};

export type DeleteClientStore = {
  findClient: (id: string) => Promise<ClientDeleteRecord | null>;
  unlinkClosedJobsAndDelete: (id: string) => Promise<void>;
};

export type DeleteClientResult =
  | { ok: true; name: string }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string; jobs?: ClientDeleteJob[] };

export function confirmMatchesClientName(confirm: string, name: string): boolean {
  return confirm.trim().toLowerCase() === name.trim().toLowerCase();
}

export function blockingClientJobs(bookings: ClientDeleteJob[]): ClientDeleteJob[] {
  return bookings.filter((job) => !isPastContractorJob(job.status));
}

export function clientDeleteBlockedMessage(jobs: ClientDeleteJob[]): string {
  const count = jobs.length;
  const noun = count === 1 ? "job is" : "jobs are";
  return `Cannot delete while ${count} ${noun} still active. Complete or cancel them first.`;
}

export function defaultDeleteClientStore(): DeleteClientStore {
  return {
    async findClient(id) {
      return prisma.customer.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          bookings: { select: { id: true, publicId: true, status: true } },
        },
      });
    },
    async unlinkClosedJobsAndDelete(id) {
      await prisma.$transaction(async (tx) => {
        const latest = await tx.customer.findUnique({
          where: { id },
          select: {
            id: true,
            bookings: { select: { id: true, publicId: true, status: true } },
          },
        });
        if (!latest) {
          throw new ClientDeleteConflict("Client not found.", 404);
        }
        const blocking = blockingClientJobs(latest.bookings);
        if (blocking.length > 0) {
          throw new ClientDeleteConflict(clientDeleteBlockedMessage(blocking), 409, blocking);
        }
        await tx.booking.updateMany({
          where: { customerId: id, status: { in: [...PAST_JOB_STATUSES] } },
          data: { customerId: null },
        });
        await tx.payment.updateMany({
          where: { customerId: id },
          data: { customerId: null },
        });
        await tx.customer.delete({ where: { id } });
      });
    },
  };
}

class ClientDeleteConflict extends Error {
  status: 404 | 409;
  jobs?: ClientDeleteJob[];

  constructor(message: string, status: 404 | 409, jobs?: ClientDeleteJob[]) {
    super(message);
    this.name = "ClientDeleteConflict";
    this.status = status;
    this.jobs = jobs;
  }
}

/**
 * Permanently remove a customer (client).
 *
 * Booking rule: open jobs (not completed/cancelled) block delete so active
 * work is not silently unlinked — same safety as contractor delete. Completed
 * and cancelled jobs stay on the books with customerId set to null;
 * denormalized name, phone, and email remain on those tickets. Payment rows
 * stay on the jobs with customerId set to null. Portal login and password-
 * reset fields go away with the customer row.
 */
export async function deleteAdminClient(
  id: string,
  confirm: string,
  store: DeleteClientStore = defaultDeleteClientStore(),
): Promise<DeleteClientResult> {
  const client = await store.findClient(id);
  if (!client) {
    return { ok: false, status: 404, error: "Client not found." };
  }
  if (!confirmMatchesClientName(confirm, client.name)) {
    return { ok: false, status: 400, error: "Type the client name to confirm deletion." };
  }

  const blocking = blockingClientJobs(client.bookings);
  if (blocking.length > 0) {
    return {
      ok: false,
      status: 409,
      error: clientDeleteBlockedMessage(blocking),
      jobs: blocking,
    };
  }

  try {
    await store.unlinkClosedJobsAndDelete(client.id);
    return { ok: true, name: client.name };
  } catch (error) {
    if (error instanceof ClientDeleteConflict) {
      return { ok: false, status: error.status, error: error.message, jobs: error.jobs };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        ok: false,
        status: 409,
        error: "Cannot delete while jobs or payments still reference this client. Complete or cancel open jobs first.",
      };
    }
    throw error;
  }
}
