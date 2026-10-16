"use client";

import { useLocale } from "next-intl";
import { LOCALES, LOCALE_COOKIE, localePath, stripLocale } from "@/i18n/locale";
import { cls } from "./ui";

/**
 * EN · FR — sets the language cookie and opens the same page at that language's
 * URL (`/fr/…` or unprefixed): on a prefixed URL the language is set
 * by the address, so a plain reload would not be enough.
 */
export function LanguageSwitcher() {
  const locale = useLocale();

  return (
    <span className="inline-flex items-center gap-1.5">
      {LOCALES.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          <button
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
              const { pathname, search, hash } = window.location;
              window.location.assign(localePath(l, stripLocale(pathname)) + search + hash);
            }}
            className={cls(
              "uppercase transition-colors cursor-pointer",
              l === locale ? "text-ink-dim font-medium" : "hover:text-ink-dim"
            )}
            aria-current={l === locale ? "true" : undefined}
          >
            {l}
          </button>
        </span>
      ))}
    </span>
  );
}
