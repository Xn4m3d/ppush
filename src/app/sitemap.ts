import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { LOCALES, localePath } from "@/i18n/locale";

// Rendered at runtime (not at build) so BASE_URL from the prod environment is used —
// otherwise the localhost fallback URLs get baked into the static file.
export const dynamic = "force-dynamic";

/**
 * Dynamic sitemap: indexable pages only (no secret links or signed-in area pages,
 * which are excluded from indexing). Each page is listed in
 * every language (`/…` English, `/fr/…` French), with its equivalents (hreflang).
 * No `lastModified`: a date recomputed on every request is ignored by
 * Google, so better not to claim anything.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.baseUrl;
  const pages: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/why", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs/api", priority: 0.7, changeFrequency: "monthly" },
    { path: "/register", priority: 0.6, changeFrequency: "monthly" },
    { path: "/legal", priority: 0.5, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" },
    // /login intentionally omitted: noindex page (no SEO value).
  ];
  const url = (locale: string, path: string) => {
    const p = localePath(locale, path);
    return p === "/" ? base : `${base}${p}`;
  };
  return pages.flatMap((p) =>
    LOCALES.map((locale) => ({
      url: url(locale, p.path),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, url(l, p.path)])),
      },
    }))
  );
}
