import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { PushList } from "@/components/push-list";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("history"),
    robots: { index: false, follow: false },
  };
}

export default async function PushesPage() {
  const t = await getTranslations("pushes");
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <PushList />
      </main>
    </>
  );
}
