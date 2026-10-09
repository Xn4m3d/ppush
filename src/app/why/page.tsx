import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import type { Locale } from "@/i18n/locale";
import { WhyContentEn } from "./content.en";
import { WhyContentFr } from "./content.fr";

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
    alternates: { canonical: "/why" },
  };
}

export default async function WhyPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? WhyContentEn;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <BackHome className="mb-6" />
      <Content />
    </main>
  );
}
