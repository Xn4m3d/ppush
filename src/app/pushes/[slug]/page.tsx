import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { PushDetail } from "@/components/push-detail";
import { PageHead } from "@/components/page-head";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("pushDetail"),
    robots: { index: false, follow: false },
  };
}

export default async function PushDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const th = await getTranslations("pageHead");

  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <PageHead eyebrow={(await getTranslations("pushes"))("title")} title={(await getTranslations("meta"))("pushDetail")} cap={th("historyCap")} />
        <div className="wrap pane glass app app-solo">
          <div className="app-main">
            <PushDetail slug={slug} />
          </div>
        </div>
      </main>
    </>
  );
}
