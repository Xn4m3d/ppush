import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import type { Locale } from "@/i18n/locale";
import { PrivacyContentEn } from "./content.en";
import { PrivacyContentFr } from "./content.fr";
import { pageAlternates } from "@/lib/seo";

const CONTENT: Record<Locale, React.ComponentType> = {
  en: PrivacyContentEn,
  fr: PrivacyContentFr,
};

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    title: t("privacy"),
    description: t("privacyDescription"),
    alternates: await pageAlternates("/privacy"),
  };
}

export default async function PrivacyPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? PrivacyContentEn;
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <Content />
      </main>
    </>
  );
}
