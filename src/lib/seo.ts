import { getLocale } from "next-intl/server";
import { LOCALES, localePath } from "@/i18n/locale";

/**
 * URL metadata for a public page: canonical address in the displayed
 * language, and its equivalents in every language (hreflang). `x-default` =
 * the unprefixed URL, which follows the browser's language.
 */
export async function pageAlternates(path: string) {
  const locale = await getLocale();
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
      "x-default": path,
    },
  };
}
