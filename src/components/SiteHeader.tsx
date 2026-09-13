"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "./BrandMark";
import { CallButton } from "./CallButton";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book" },
  { href: "/contractors", label: "Contractors" },
  { href: "/status", label: "Track a job" },
  { href: "/account", label: "My jobs" },
  { href: "/about", label: "About" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/95 text-cream backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <BrandMark compact light />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-cream/80 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden sm:block">
          <CallButton size="md" variant="ember" />
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-md border border-white/15 lg:hidden"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <span className="block h-0.5 w-5 bg-cream" />
        </button>
      </div>
      {open ? (
        <nav className="border-t border-white/10 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-3 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <CallButton className="w-full" />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
