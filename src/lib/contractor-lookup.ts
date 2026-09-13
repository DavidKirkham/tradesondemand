import { prisma } from "./prisma";

/** Approved partners only — pending/rejected stay off public routes. */
export function findApprovedContractor(slugOrId: string) {
  return prisma.contractor.findFirst({
    where: {
      status: "APPROVED",
      OR: [{ slug: slugOrId }, { publicId: slugOrId }, { id: slugOrId }],
    },
  });
}
