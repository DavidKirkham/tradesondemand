import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/admin",
        "/ops",
        "/api/ops",
        "/account",
        "/api/account",
        "/api/stripe",
        "/contractor",
        "/api/contractor",
      ],
    },
  };
}
