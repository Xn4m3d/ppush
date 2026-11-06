import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import type { Locale } from "@/i18n/locale";
import { WhyContentEn } from "./content.en";
import { WhyContentFr } from "./content.fr";
import { pageAlternates } from "@/lib/seo";

/**
 * "What is this site for?" — concrete use, no technical detail (that lives
 * in /about). Prose per locale in content.<locale>.tsx, like /about.
 */
const CONTENT: Record<Locale, React.ComponentType> = {
  en: WhyContentEn,
  fr: WhyContentFr,
};

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    title: t("why"),
    description: t("whyDescription"),
    alternates: await pageAlternates("/why"),
  };
}

export default async function WhyPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? WhyContentEn;
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <Content />
      </main>
    </>
  );
}
