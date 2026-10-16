import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, isLocale, pickLocale } from "./locale";

export default getRequestConfig(async () => {
  const h = await headers();
  const fromUrl = h.get(LOCALE_HEADER); // /fr/... (set by the middleware)
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromUrl)
    ? fromUrl
    : isLocale(fromCookie)
      ? fromCookie
      : pickLocale(h.get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // a missing key must break the build/tests, never silently render
    onError(error) {
      console.error("[i18n]", error.message);
    },
    getMessageFallback: ({ key, namespace }) =>
      `⟦${namespace ? `${namespace}.` : ""}${key}⟧`,
  };
});

export { DEFAULT_LOCALE };
