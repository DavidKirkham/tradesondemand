"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function ContractorAppShell({
  businessName,
  children,
}: {
  businessName: string;
  children: import("react").ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const onJobs = pathname === "/contractor" || pathname.startsWith("/contractor/jobs");
  const onProfile = pathname.startsWith("/contractor/profile");

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/contractor/logout", { method: "POST" });
    router.push("/contractor");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-cream">
      <header className="sticky top-0 z-20 border-b border-line bg-navy px-4 py-3 text-cream">
        <p className="stamp text-[0.65rem] text-gold">TOD contractor</p>
        <p className="font-display text-lg leading-tight">{businessName}</p>
        <p className="text-xs text-cream/70">Customers pay Trades on Demand — no on-site collection.</p>
      </header>
      <div className="flex-1 px-4 pb-24 pt-4">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-3 text-center text-sm font-semibold">
          <Link href="/contractor" className={`py-3 ${onJobs ? "text-ember" : "text-navy"}`}>
            Jobs
          </Link>
          <Link href="/contractor/profile" className={`py-3 ${onProfile ? "text-ember" : "text-navy"}`}>
            Profile
          </Link>
          <button type="button" onClick={signOut} disabled={signingOut} className="py-3 text-muted">
            {signingOut ? "…" : "Sign out"}
          </button>
        </div>
      </nav>
    </div>
  );
}
