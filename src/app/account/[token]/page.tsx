import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountMagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/api/account/claim?token=${encodeURIComponent(token)}`);
}
