import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StickyCallBar } from "@/components/StickyCallBar";
import { formatPhone, getDispatchPhone } from "@/lib/phone";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const phone = formatPhone(getDispatchPhone());

export const metadata: Metadata = {
  title: {
    default: "Trades on Demand — Any trade, Kansas City metro",
    template: "%s · Trades on Demand",
  },
  description:
    "Book any trade service in the Kansas City metro. Emergency or routine. Plumbing, electrical, HVAC, and 15 more — KCMO and Johnson County only.",
  applicationName: "Trades on Demand",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Trades on Demand",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#102033",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const surface = (await headers()).get("x-tod-surface");
  const contractorApp = surface === "contractor";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className={`flex min-h-full flex-col ${contractorApp ? "" : "pb-20 sm:pb-0"}`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cream focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {contractorApp ? null : <SiteHeader />}
        <main id="main" className="flex-1">
          {children}
        </main>
        {contractorApp ? null : (
          <>
            <SiteFooter />
            <StickyCallBar />
          </>
        )}
        <PwaRegister />
        <p className="sr-only">Dispatch phone {phone}</p>
      </body>
    </html>
  );
}
