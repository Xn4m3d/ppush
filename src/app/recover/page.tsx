import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
import { RecoverForm } from "@/components/recover-form";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return { title: t("recover"), description: t("recoverDescription"), robots: { index: false } };
}

export default async function RecoverPage() {
  if (await currentUser()) redirect("/account");
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <BackHome className="absolute left-4 top-4 sm:left-6 sm:top-6" />
      <Logo />
      <RecoverForm turnstileSiteKey={config.turnstileSiteKey} />
    </main>
  );
}
