import { isOpsAuthenticated } from "@/lib/ops-auth";
import { AdminLogin } from "./AdminLogin";
import { AdminShell } from "./AdminShell";

export async function AdminGate({ children }: { children: import("react").ReactNode }) {
  if (!(await isOpsAuthenticated())) {
    return <AdminLogin />;
  }
  return <AdminShell>{children}</AdminShell>;
}
