import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account/AccountAuthForm";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { isSafeAccountNextPath } from "@/lib/customer-paths";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; setup?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const customer = await getCustomerFromCookie();
  const next = isSafeAccountNextPath(params.next) ? params.next : "/account";
  if (customer && params.setup !== "1") {
    redirect(next);
  }

  const initialMode = params.setup === "1" ? "setup" : "signin";
  return <AccountAuthForm nextPath={params.next} initialMode={initialMode} notice={params.notice} />;
}
