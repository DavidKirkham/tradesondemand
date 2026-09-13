"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/account", label: "Jobs", match: (path: string) => path === "/account" || path.startsWith("/account/jobs") },
  { href: "/account/profile", label: "Profile", match: (path: string) => path.startsWith("/account/profile") },
] as const;

export function AccountShell({
  name,
  needsPassword = false,
  children,
}: {
  name: string;
  needsPassword?: boolean;
  children: import("react").ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/account/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24 sm:pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="stamp text-xs text-ember">Customer portal</p>
          <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">{name}</h1>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="text-sm font-semibold text-muted hover:text-navy disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <nav className="mt-5 flex gap-2">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ${
                active ? "bg-navy text-cream" : "border border-line bg-paper text-navy"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {needsPassword ? (
        <p className="mt-4 rounded-xl border border-gold/40 bg-gold/15 px-4 py-3 text-sm text-navy">
          Set a password so you can come back to these jobs.{" "}
          <Link href="/account/profile" className="font-semibold text-ember">
            Protect this account
          </Link>
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}
