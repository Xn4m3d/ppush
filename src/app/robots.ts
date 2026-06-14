import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/**
 * Dynamic robots.txt. Public pages are indexable; sensitive surfaces are excluded:
 * secret links (/p/), the signed-in area (/pushes, /account, /admin) and the JSON
 * API (no SEO value, and it is the mutation surface).
 */
export default function robots(): MetadataRoute.Robots {
  const base = config.baseUrl;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/p/", "/pushes", "/account", "/admin", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
