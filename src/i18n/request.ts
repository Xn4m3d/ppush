import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, pickLocale } from "./locale";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie)
    ? fromCookie
    : pickLocale((await headers()).get("accept-language"));

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
