import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { AdminPanel } from "@/components/admin-panel";
import { MiniCloud } from "@/components/diffusion/mini-cloud";

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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h1 className="text-3xl font-bold">{(await getTranslations("admin"))("title")}</h1>
          <MiniCloud className="hidden sm:block" seed={41} />
        </div>
        <AdminPanel selfId={user.id} />
      </main>
    </>
  );
}
