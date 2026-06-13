import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { PushDetail } from "@/components/push-detail";

export async function generateMetadata() {
  return { title: (await getTranslations("meta"))("pushDetail") };
}

export default async function PushDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { slug } = await params;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <PushDetail slug={slug} />
      </main>
    </>
  );
}
