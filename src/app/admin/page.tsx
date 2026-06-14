import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { AdminPanel } from "@/components/admin-panel";

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
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          {(await getTranslations("admin"))("title")}
        </h1>
        <AdminPanel selfId={user.id} />
      </main>
    </>
  );
}
