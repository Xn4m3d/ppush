import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { PushList } from "@/components/push-list";
import { PageHead } from "@/components/page-head";
import { prisma } from "@/lib/db";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("history"),
    robots: { index: false, follow: false },
  };
}

export default async function PushesPage() {
  const t = await getTranslations("pushes");
  const th = await getTranslations("pageHead");
  const user = await currentUser();
  if (!user) redirect("/login");
  // same criteria as the "active" filter of /api/pushes
  const [total, active] = await Promise.all([
    prisma.push.count({ where: { userId: user.id } }),
    prisma.push.count({ where: { userId: user.id, payloadDeleted: false, expiresAt: { gt: new Date() } } }),
  ]);

  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <PageHead
          eyebrow={th("account")}
          title={t("title")}
          meta={
            <>
              <span>{th.rich("links", { count: total, b: (c) => <b>{c}</b> })}</span>
              <span>{th.rich("active", { count: active, b: (c) => <b>{c}</b> })}</span>
            </>
          }
          cap={th("historyCap")}
        />
        <div className="wrap pane glass app">
          <PushList />
        </div>
      </main>
    </>
  );
}
