import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Contractor",
  robots: { index: false, follow: false },
  manifest: "/contractor/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TOD Contractor",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#102033",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function ContractorLayout({ children }: { children: import("react").ReactNode }) {
  return children;
}
