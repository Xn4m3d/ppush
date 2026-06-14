import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
import { SourceLink } from "@/components/source-link";
import { currentUser } from "@/lib/auth";
import type { Locale } from "@/i18n/locale";
import { AboutContentEn } from "./content.en";
import { AboutContentFr } from "./content.fr";

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
    description: t("description"),
  };
}

export default async function AboutPage() {
  const locale = (await getLocale()) as Locale;
  const user = await currentUser();
  const Content = CONTENT[locale] ?? AboutContentEn;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <BackHome className="mb-6" />
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Content showRegister={!user} />
      <div className="mt-10 border-t border-line/40 pt-6 text-center">
        <SourceLink />
      </div>
    </main>
  );
}
