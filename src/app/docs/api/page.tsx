import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import type { Locale } from "@/i18n/locale";
import { ApiDocsContentEn } from "./content.en";
import { ApiDocsContentFr } from "./content.fr";
import { pageAlternates } from "@/lib/seo";

/**
 * Markup-rich docs → per-locale content in content.<locale>.tsx
 * (same structure in each language; adding a language = adding a file).
 */
const CONTENT: Record<Locale, React.ComponentType> = {
  en: ApiDocsContentEn,
  fr: ApiDocsContentFr,
};

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    title: t("apiDocs"),
    description: t("apiDocsDescription"),
    alternates: await pageAlternates("/docs/api"),
  };
}

export default async function ApiDocsPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? ApiDocsContentEn;
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <Content />
      </main>
    </>
  );
}
