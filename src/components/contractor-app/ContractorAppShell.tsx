"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AvailableJobsWatcher } from "@/components/contractor-app/AvailableJobsWatcher";

const NAV = [
  { href: "/contractor", label: "Jobs", match: (path: string) => path === "/contractor" || path.startsWith("/contractor/jobs") },
  { href: "/contractor/past", label: "Past", match: (path: string) => path.startsWith("/contractor/past") },
  { href: "/contractor/messages", label: "SMS", match: (path: string) => path.startsWith("/contractor/messages") },
  { href: "/contractor/payments", label: "Pay", match: (path: string) => path.startsWith("/contractor/payments") },
  { href: "/contractor/profile", label: "Profile", match: (path: string) => path.startsWith("/contractor/profile") },
] as const;

export function ContractorAppShell({
  businessName,
  availableCount = 0,
  children,
}: {
  businessName: string;
  availableCount?: number;
  children: import("react").ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/contractor/logout", { method: "POST" });
    router.push("/contractor");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-cream">
      <header className="sticky top-0 z-20 border-b border-line bg-navy px-4 py-3 text-cream">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="stamp text-[0.65rem] text-gold">TOD contractor</p>
            <p className="font-display text-lg leading-tight">{businessName}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="shrink-0 pt-1 text-xs font-semibold text-cream/70"
          >
            {signingOut ? "…" : "Sign out"}
          </button>
        </div>
        <p className="text-xs text-cream/70">Customers pay Trades on Demand — no on-site collection.</p>
        <AvailableJobsWatcher initialCount={availableCount} />
      </header>
      <div className="flex-1 px-4 pb-24 pt-4">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5 text-center text-xs font-semibold">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-3 ${active ? "text-ember" : "text-navy"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
