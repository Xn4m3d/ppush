"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { THEMES, THEME_COOKIE, THEME_SWATCH, type Theme } from "@/lib/themes";
import { cls } from "./ui";

/**
 * Theme picker — sets the `theme` cookie then re-renders server-side (same
 * pattern as LanguageSwitcher). Rendered for the admin only.
 */
export function ThemeSwitcher({ current }: { current: Theme }) {
  const router = useRouter();
  const t = useTranslations("themes");

  return (
    <span className="inline-flex items-center gap-1.5">
      {THEMES.map((id) => {
        const [bg, line, accent] = THEME_SWATCH[id];
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => {
              document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
              router.refresh();
            }}
            title={t(id)}
            aria-label={t(id)}
            aria-current={active ? "true" : undefined}
            className={cls(
              "inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 transition-colors cursor-pointer",
              active
                ? "border-line-soft text-ink-dim"
                : "border-transparent text-ink-faint hover:border-line hover:text-ink-dim"
            )}
          >
            <span className="flex" aria-hidden>
              <span
                className="size-2.5 rounded-full ring-1 ring-black/40"
                style={{ background: bg }}
              />
              <span
                className="-ml-1 size-2.5 rounded-full ring-1 ring-black/40"
                style={{ background: line }}
              />
              <span
                className="-ml-1 size-2.5 rounded-full ring-1 ring-black/40"
                style={{ background: accent }}
              />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {t(id)}
            </span>
          </button>
        );
      })}
    </span>
  );
}
