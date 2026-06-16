import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { getActiveTips } from "@/lib/tips";
import { AuthForm } from "@/components/auth-form";
import { RegisterAside } from "@/components/register-aside";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
import type { Locale } from "@/i18n/locale";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return { title: t("register"), description: t("registerDescription") };
}

export default async function RegisterPage() {
  if (await currentUser()) redirect("/");
  const locale = (await getLocale()) as Locale;
  const tips = await getActiveTips(locale);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <BackHome className="absolute left-4 top-4 sm:left-6 sm:top-6" />
      <Logo />
      <div className="flex w-full max-w-4xl flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <RegisterAside tips={tips} />
        <AuthForm mode="register" turnstileSiteKey={config.turnstileSiteKey} />
      </div>
    </main>
  );
}
