import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trades on Demand",
    short_name: "Trades KC",
    description: "Book any trade in the Kansas City metro — emergency or routine.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#102033",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
