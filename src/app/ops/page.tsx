import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";
import { OpsBoard } from "@/components/ops/OpsBoard";
import { OpsLogin } from "@/components/ops/OpsLogin";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const authed = await isOpsAuthenticated();
  if (!authed) {
    return <OpsLogin />;
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <OpsBoard
      initialBookings={bookings.map((booking) => ({
        ...booking,
        createdAt: booking.createdAt.toISOString(),
      }))}
    />
  );
}
