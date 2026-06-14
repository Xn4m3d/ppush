import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// Rendered at runtime (not at build) so BASE_URL from the prod environment is used —
// otherwise the localhost fallback URLs get baked into the static file.
export const dynamic = "force-dynamic";

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
