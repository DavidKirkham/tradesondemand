import { ContractorResetPassword } from "@/components/contractor-app/ContractorResetPassword";

export const dynamic = "force-dynamic";

export default async function ContractorResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ContractorResetPassword token={token} />;
}
