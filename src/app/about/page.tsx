import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { currentUser } from "@/lib/auth";
import type { Locale } from "@/i18n/locale";
import { AboutContentEn } from "./content.en";
import { AboutContentFr } from "./content.fr";
import { pageAlternates } from "@/lib/seo";

/**
 * Markup-rich prose page → per-locale content in content.<locale>.tsx
 * (same structure in each language; adding a language = adding a file).
 */
const CONTENT: Record<Locale, React.ComponentType<{ showRegister: boolean }>> = {
  en: AboutContentEn,
  fr: AboutContentFr,
};

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    title: t("about"),
    description: t("aboutDescription"),
    alternates: await pageAlternates("/about"),
  };
}

export default async function AboutPage() {
  const locale = (await getLocale()) as Locale;
  const user = await currentUser();
  const Content = CONTENT[locale] ?? AboutContentEn;
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <Content showRegister={!user} />
      </main>
    </>
  );
}
