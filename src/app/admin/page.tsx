import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { AdminPanel } from "@/components/admin-panel";
import { PageHead } from "@/components/page-head";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("admin"),
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <PageHead eyebrow={(await getTranslations("pageHead"))("admin")} title={(await getTranslations("admin"))("title")} />
        <div className="wrap pane glass app">
          <AdminPanel selfId={user.id} />
        </div>
      </main>
    </>
  );
}
