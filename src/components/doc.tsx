import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { localePath } from "@/i18n/locale";
import { Toc } from "./toc";

// the reading pages, suggested from one another
const READING = [
  { href: "/why", key: "why" },
  { href: "/about", key: "about" },
  { href: "/docs/api", key: "api" },
  { href: "/privacy", key: "privacy" },
  { href: "/legal", key: "legal" },
] as const;

/**
 * "Reading" template: on a tinted pane, the sticky contents on the left
 * (the page's sections, then the other reading pages) and the numbered
 * sections on the right. `current`: the page's path, left out of the suggestions.
 */
export async function Doc({ current, children }: { current: string; children: ReactNode }) {
  const t = await getTranslations("doc");
  const locale = await getLocale();
  return (
    <div className="wrap pane glass doc">
      <aside className="toc">
        <Toc label={t("onThisPage")} />
        <div className="toc-more">
          <p className="eyebrow mb-1.5">{t("further")}</p>
          {READING.filter((r) => r.href !== current).map((r) => (
            <Link key={r.href} href={localePath(locale, r.href)}>
              {t(r.key)} <small>{t(`${r.key}Hint`)}</small>
            </Link>
          ))}
        </div>
      </aside>
      <div className="doc-body">{children}</div>
    </div>
  );
}
