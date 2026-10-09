import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { PushList } from "@/components/push-list";
import { MiniCloud } from "@/components/diffusion/mini-cloud";

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
        <div className="mb-6 flex items-end justify-between gap-6">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <MiniCloud className="hidden sm:block" seed={17} />
        </div>
        <PushList />
      </main>
    </>
  );
}
