import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminTakeCallForm } from "@/components/admin/AdminTakeCallForm";
import { toAdminIntakeContractor } from "@/lib/admin-intake";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTakeCallPage() {
  return (
    <AdminGate>
      <TakeCall />
    </AdminGate>
  );
}

async function TakeCall() {
  if (!(await isOpsAuthenticated())) return null;
  const approved = await prisma.contractor.findMany({
    where: { status: "APPROVED" },
    orderBy: { businessName: "asc" },
  });
  const contractors = approved.map(toAdminIntakeContractor);

  return (
    <div>
      <p className="stamp text-xs text-ember">Dispatch</p>
      <h1 className="font-display text-3xl text-navy">Take a call</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Phone intake for (816) 516-0735. Create the job, match or add the client, and assign an approved KC metro
        contractor in one step. Existing jobs still use Assign on{" "}
        <Link href="/admin/jobs" className="font-semibold text-ember">
          job detail
        </Link>
        .
      </p>
      <div className="mt-6">
        <AdminTakeCallForm contractors={contractors} />
      </div>
    </div>
  );
}
