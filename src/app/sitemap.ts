import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// Rendered at runtime (not at build) so BASE_URL from the prod environment is used —
// otherwise the localhost fallback URLs get baked into the static file.
export const dynamic = "force-dynamic";

/**
 * Dynamic sitemap: indexable pages only (no secret links or signed-in area pages,
 * which are excluded from indexing).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.baseUrl;
  const now = new Date();
  const pages: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs/api", priority: 0.7, changeFrequency: "monthly" },
    { path: "/register", priority: 0.6, changeFrequency: "monthly" },
    { path: "/legal", priority: 0.5, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" },
    { path: "/login", priority: 0.4, changeFrequency: "monthly" },
  ];
  return pages.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
