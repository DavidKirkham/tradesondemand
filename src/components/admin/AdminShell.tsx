"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/contractors", label: "Subcontractors" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/invoices", label: "Invoices due" },
  { href: "/admin/payouts", label: "Payouts" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: import("react").ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 rounded-2xl border border-line bg-paper p-4 lg:sticky lg:top-20 lg:w-56">
        <p className="stamp text-xs text-ember">Backend</p>
        <p className="mt-1 font-display text-xl text-navy">Admin</p>
        <p className="mt-1 text-xs text-muted">Private. Not a public directory.</p>
        <nav className="mt-4 flex flex-row flex-wrap gap-2 lg:flex-col">
          <Link
            href="/"
            className="rounded-full border border-line px-3 py-2 text-sm font-semibold text-navy"
          >
            Home
          </Link>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                isActive(pathname, link.href) ? "bg-navy text-cream" : "border border-line text-navy"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-4 text-left text-sm font-semibold text-ember disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
