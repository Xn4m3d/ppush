import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
import type { Locale } from "@/i18n/locale";
import { ApiDocsContentEn } from "./content.en";
import { ApiDocsContentFr } from "./content.fr";

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
  return { title: t("apiDocs"), description: t("apiDocsDescription") };
}

export default async function ApiDocsPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? ApiDocsContentEn;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <BackHome className="mb-6" />
      <div className="mb-4 flex justify-center">
        <Logo />
      </div>
      <Content />
    </main>
  );
}
