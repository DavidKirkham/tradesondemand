import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "TOD Contractor",
    short_name: "TOD Jobs",
    description: "Assigned Kansas City jobs for approved Trades on Demand partners.",
    start_url: "/contractor",
    scope: "/contractor",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#102033",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  });
}
