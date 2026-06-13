"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/locale";
import { cls } from "./ui";

/** EN · FR — sets the language cookie then re-renders everything server-side. */
export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  return (
    <span className="inline-flex items-center gap-1.5">
      {LOCALES.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          <button
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
              router.refresh();
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
