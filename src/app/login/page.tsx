import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { Header } from "@/components/header";
import { AuthBench, AccountStage } from "@/components/auth-bench";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  // Login page: no SEO value, keep it out of the index (but follow links).
  // Consistent with its removal from the sitemap.
  return {
    title: t("login"),
    description: t("loginDescription"),
    robots: { index: false, follow: true },
  };
}

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <AuthBench stage={<AccountStage />}>
          <AuthForm mode="login" />
        </AuthBench>
      </main>
    </>
  );
}
