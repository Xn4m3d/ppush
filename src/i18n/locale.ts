/**
 * Supported locales. EN = default; FR auto-applied if the browser is
 * French-speaking (Accept-Language). To add a language: add it here, create
 * messages/<code>.json and (for /about and /docs/api) a content.<code>.tsx.
 */

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";
/**
 * Language set by the URL: the middleware serves `/fr/...` by rewriting to
 * `/...` and sets this header. It takes precedence over the cookie and the browser, so
 * that each language has its own indexable URLs (Google sends no
 * Accept-Language: without a prefix, it only ever saw English).
 */
export const LOCALE_HEADER = "x-ppush-locale";

/** Path in a language: English (default) unprefixed, the others under `/<code>`. */
export function localePath(locale: string, path: string): string {
  if (locale === DEFAULT_LOCALE || !isLocale(locale)) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Removes the language prefix from a path (`/fr/about` → `/about`, `/fr` → `/`). */
export function stripLocale(path: string): string {
  const m = path.match(/^\/([a-z]{2})(\/.*)?$/);
  return m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE ? m[2] || "/" : path;
}

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** Picks the locale from an Accept-Language header. */
export function pickLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  // entries sorted by decreasing quality: "fr-FR,fr;q=0.9,en;q=0.8"
  const langs = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of langs) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Locale of an API request: cookie set by the switcher, else the browser. */
export function requestLocale(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  if (m && isLocale(m[1])) return m[1];
  return pickLocale(req.headers.get("accept-language"));
}
