import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type JobDeletePayment = {
  id: string;
  publicId: string;
  status: string;
  type: string;
  amountCents: number;
  stripeCheckoutSessionId: string | null;
};

export type JobDeleteRecord = {
  id: string;
  publicId: string;
  status: string;
  payments: JobDeletePayment[];
};

export type DeleteJobStore = {
  findJob: (id: string) => Promise<JobDeleteRecord | null>;
  deleteJob: (id: string) => Promise<void>;
};

export type DeleteJobResult =
  | { ok: true; publicId: string }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string; payments?: JobDeletePayment[] };

export function confirmMatchesJobId(confirm: string, publicId: string): boolean {
  return confirm.trim().toLowerCase() === publicId.trim().toLowerCase();
}

export function isPaidInvoice(payment: Pick<JobDeletePayment, "status">): boolean {
  return payment.status === "PAID";
}

/** PENDING checkout that Stripe could still complete after the job is gone. */
export function isOpenStripeCheckout(payment: Pick<JobDeletePayment, "status" | "stripeCheckoutSessionId">): boolean {
  return payment.status === "PENDING" && Boolean(payment.stripeCheckoutSessionId);
}

export function blockingJobPayments(payments: JobDeletePayment[]): JobDeletePayment[] {
  return payments.filter((payment) => isPaidInvoice(payment) || isOpenStripeCheckout(payment));
}

export function jobDeleteBlockedMessage(payments: JobDeletePayment[]): string {
  const paid = payments.filter(isPaidInvoice).length;
  const open = payments.filter(isOpenStripeCheckout).length;
  if (paid > 0 && open > 0) {
    return "Cannot delete while paid invoices or an open Stripe checkout remain on this job. Refund paid items or let the session expire first.";
  }
  if (paid > 0) {
    const noun = paid === 1 ? "paid invoice is" : "paid invoices are";
    return `Cannot delete while ${paid} ${noun} on this job. Refund them first, or leave the job on the books.`;
  }
  if (open > 0) {
    const noun = open === 1 ? "Stripe checkout is" : "Stripe checkouts are";
    return `Cannot delete while ${open} open ${noun} still pending. Let the session expire or complete first.`;
  }
  return "Cannot delete while paid invoices or an open Stripe checkout remain on this job.";
}

export function defaultDeleteJobStore(): DeleteJobStore {
  return {
    async findJob(id) {
      return prisma.booking.findFirst({
        where: { OR: [{ id }, { publicId: id }] },
        select: {
          id: true,
          publicId: true,
          status: true,
          payments: {
            select: {
              id: true,
              publicId: true,
              status: true,
              type: true,
              amountCents: true,
              stripeCheckoutSessionId: true,
            },
          },
        },
      });
    },
    async deleteJob(id) {
      await prisma.$transaction(async (tx) => {
        const latest = await tx.booking.findUnique({
          where: { id },
          select: {
            id: true,
            payments: {
              select: {
                id: true,
                publicId: true,
                status: true,
                type: true,
                amountCents: true,
                stripeCheckoutSessionId: true,
              },
            },
          },
        });
        if (!latest) {
          throw new JobDeleteConflict("Job not found.", 404);
        }
        const blocking = blockingJobPayments(latest.payments);
        if (blocking.length > 0) {
          throw new JobDeleteConflict(jobDeleteBlockedMessage(blocking), 409, blocking);
        }
        await tx.booking.delete({ where: { id } });
      });
    },
  };
}

class JobDeleteConflict extends Error {
  status: 404 | 409;
  payments?: JobDeletePayment[];

  constructor(message: string, status: 404 | 409, payments?: JobDeletePayment[]) {
    super(message);
    this.name = "JobDeleteConflict";
    this.status = status;
    this.payments = payments;
  }
}

/**
 * Permanently remove a booking (job).
 *
 * Payment rule: PAID invoices stay on the books — delete is blocked so Stripe
 * ledger rows are not silently cascaded. Open Stripe Checkout sessions
 * (PENDING + stripeCheckoutSessionId) also block, because a customer could
 * still complete payment after the job vanished.
 *
 * Allowed jobs cascade StatusEvents (Prisma onDelete), remaining Payment rows
 * (PENDING without a session, or REFUNDED), and drop client SMS fields with
 * the booking row. Job status itself does not block (spam or cancelled tickets
 * can be removed).
 */
export async function deleteAdminJob(
  id: string,
  confirm: string,
  store: DeleteJobStore = defaultDeleteJobStore(),
): Promise<DeleteJobResult> {
  const job = await store.findJob(id);
  if (!job) {
    return { ok: false, status: 404, error: "Job not found." };
  }
  if (!confirmMatchesJobId(confirm, job.publicId)) {
    return { ok: false, status: 400, error: "Type the job ID to confirm deletion." };
  }

  const blocking = blockingJobPayments(job.payments);
  if (blocking.length > 0) {
    return {
      ok: false,
      status: 409,
      error: jobDeleteBlockedMessage(blocking),
      payments: blocking,
    };
  }

  try {
    await store.deleteJob(job.id);
    return { ok: true, publicId: job.publicId };
  } catch (error) {
    if (error instanceof JobDeleteConflict) {
      return { ok: false, status: error.status, error: error.message, payments: error.payments };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        ok: false,
        status: 409,
        error: "Cannot delete while related payment or event rows still reference this job.",
      };
    }
    throw error;
  }
}
