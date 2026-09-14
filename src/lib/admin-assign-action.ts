import {
  adminAssignEventNote,
  contractorOffersTrade,
  jobIsAssignable,
  nextStatusOnAdminAssign,
} from "./admin-assign";
import { BOOKING_SMS_OMIT } from "./booking-sms-columns";
import { notifyContractorBookedSafe } from "./notify-contractor-booked";
import { prisma } from "./prisma";

export async function assignBookingToApprovedContractor(bookingId: string, contractorId: string) {
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    include: { contractor: true },
    omit: BOOKING_SMS_OMIT,
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
    omit: BOOKING_SMS_OMIT,
  });

  await notifyContractorBookedSafe({
    contractorId: contractor.id,
    contractorPhone: contractor.phone,
    job: {
      id: updated.id,
      publicId: updated.publicId,
      trade: updated.trade,
      urgency: updated.urgency,
      city: updated.city,
    },
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
