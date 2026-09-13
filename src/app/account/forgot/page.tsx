import type { Metadata } from "next";
import { AccountForgotForm } from "@/components/account/AccountForgotForm";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function AccountForgotPage() {
  return <AccountForgotForm />;
}
