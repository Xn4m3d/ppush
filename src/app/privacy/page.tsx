import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
import type { Locale } from "@/i18n/locale";
import { PrivacyContentEn } from "./content.en";
import { PrivacyContentFr } from "./content.fr";

const CONTENT: Record<Locale, React.ComponentType> = {
  en: PrivacyContentEn,
  fr: PrivacyContentFr,
};

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return { title: t("privacy"), description: t("privacyDescription") };
}

export default async function PrivacyPage() {
  const locale = (await getLocale()) as Locale;
  const Content = CONTENT[locale] ?? PrivacyContentEn;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <BackHome className="mb-6" />
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="space-y-10">
        <Content />
      </div>
    </main>
  );
}
