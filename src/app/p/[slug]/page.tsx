import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { SecretViewer } from "@/components/secret-viewer";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("sharedSecret"),
    robots: { index: false, follow: false },
  };
}

export default async function PublicPushPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("viewer");
  const user = await currentUser();
  return (
    <>
      <Header />
      <main className="relative flex flex-1 flex-col">
        <SecretViewer slug={slug} autoOpen={!!user?.autoOpenUrls} />
        <p className="pb-6 text-center text-xs text-ink-faint">{t("pageFootnote")}</p>
      </main>
    </>
  );
}
