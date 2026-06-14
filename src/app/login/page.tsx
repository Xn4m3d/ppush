import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return { title: t("login"), description: t("loginDescription") };
}

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <BackHome className="absolute left-4 top-4 sm:left-6 sm:top-6" />
      <Logo />
      <AuthForm mode="login" />
    </main>
  );
}
