import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
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
    <main className="relative flex min-h-screen flex-col">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <BackHome />
      </div>
      <SecretViewer slug={slug} autoOpen={!!user?.autoOpenUrls} />
      <p className="pb-6 text-center text-xs text-ink-faint">{t("pageFootnote")}</p>
    </main>
  );
}
