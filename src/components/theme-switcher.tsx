"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DAY_START, DAY_END, THEME_CHOICES, THEME_COOKIE, THEME_SWATCH, type ThemeChoice } from "@/lib/themes";
import { cls } from "./ui";

/**
 * PUBLIC theme selector: Auto (day mecha / night midnight) · Midnight ·
 * Mecha. Applies the theme immediately client-side (no refresh: the SSR
 * doesn't know the local hour and would override the nightly auto). Sets the cookie;
 * for a signed-in user (`persist`), also saves the preference.
 */
export function ThemeSwitcher({ current, persist }: { current: ThemeChoice; persist: boolean }) {
  const t = useTranslations("themes");
  const [active, setActive] = useState<ThemeChoice>(current);

  return (
    <span className="inline-flex items-center gap-1">
      {THEME_CHOICES.map((id) => {
        const [bg, line, accent] = THEME_SWATCH[id];
        const on = id === active;
        return (
          <button
            key={id}
            onClick={() => {
              setActive(id);
              document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
              const h = new Date().getHours();
              document.documentElement.dataset.theme =
                id === "midnight" || id === "mecha" ? id : h >= DAY_START && h < DAY_END ? "mecha" : "midnight";
              if (persist) {
                fetch("/api/account/theme", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ theme: id }),
                }).catch(() => {});
              }
            }}
            title={t(id)}
            aria-label={t(id)}
            aria-current={on ? "true" : undefined}
            className={cls(
              "inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 transition-colors cursor-pointer",
              on
                ? "border-line-soft text-ink-dim"
                : "border-transparent text-ink-faint hover:border-line hover:text-ink-dim"
            )}
          >
            <span className="flex" aria-hidden>
              <span className="size-2.5 rounded-full ring-1 ring-black/40" style={{ background: bg }} />
              <span className="-ml-1 size-2.5 rounded-full ring-1 ring-black/40" style={{ background: line }} />
              <span className="-ml-1 size-2.5 rounded-full ring-1 ring-black/40" style={{ background: accent }} />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide">{t(id)}</span>
          </button>
        );
      })}
    </span>
  );
}
