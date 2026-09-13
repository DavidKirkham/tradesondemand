import {
  adminAssignEventNote,
  contractorOffersTrade,
  jobIsAssignable,
  nextStatusOnAdminAssign,
} from "./admin-assign";
import { prisma } from "./prisma";

export async function assignBookingToApprovedContractor(bookingId: string, contractorId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { contractor: true },
  });
  if (!booking) {
    return { ok: false as const, status: 404, error: "Job not found." };
  }
  if (!jobIsAssignable(booking.status)) {
    return { ok: false as const, status: 400, error: "Cannot assign a cancelled job." };
  }

  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!contractor || contractor.status !== "APPROVED") {
    return { ok: false as const, status: 400, error: "Pick an approved subcontractor." };
  }
  if (!contractorOffersTrade(contractor.tradesJson, booking.trade)) {
    return {
      ok: false as const,
      status: 400,
      error: "That shop is not licensed for this job's trade.",
    };
  }
  if (booking.contractorId === contractor.id) {
    return { ok: false as const, status: 400, error: "This job is already assigned to that shop." };
  }

  const nextStatus = nextStatusOnAdminAssign(booking.status) ?? booking.status;
  const note = adminAssignEventNote(contractor.businessName, booking.contractor?.businessName);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      contractorId: contractor.id,
      matchPreference: "SPECIFIC",
      status: nextStatus,
      events: { create: { status: nextStatus, note } },
    },
    include: { contractor: true },
  });

  return {
    ok: true as const,
    booking: {
      id: updated.id,
      publicId: updated.publicId,
      status: updated.status,
      contractorId: updated.contractorId,
      contractorName: updated.contractor?.businessName ?? null,
    },
  };
}
