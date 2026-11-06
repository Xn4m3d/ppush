import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import type { Locale } from "@/i18n/locale";
import { LegalContentEn } from "./content.en";
import { LegalContentFr } from "./content.fr";
import { pageAlternates } from "@/lib/seo";

const CONTENT: Record<Locale, React.ComponentType> = {
  en: LegalContentEn,
  fr: LegalContentFr,
};

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    title: t("legal"),
    description: t("legalDescription"),
    alternates: await pageAlternates("/legal"),
  };
}

export default async function LegalPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? LegalContentEn;
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <Content />
      </main>
    </>
  );
}
