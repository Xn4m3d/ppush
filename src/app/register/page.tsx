import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { getActiveTips } from "@/lib/tips";
import { AuthForm } from "@/components/auth-form";
import { RegisterAside } from "@/components/register-aside";
import { Header } from "@/components/header";
import { AuthBench } from "@/components/auth-bench";
import type { Locale } from "@/i18n/locale";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    title: t("register"),
    description: t("registerDescription"),
    alternates: await pageAlternates("/register"),
  };
}

export default async function RegisterPage() {
  if (await currentUser()) redirect("/");
  const locale = (await getLocale()) as Locale;
  const tips = await getActiveTips(locale);
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <AuthBench stage={<RegisterAside tips={tips} />}>
          <AuthForm mode="register" turnstileSiteKey={config.turnstileSiteKey} />
        </AuthBench>
      </main>
    </>
  );
}
