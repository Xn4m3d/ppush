import { getTranslations } from "next-intl/server";
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
  return (
    <main className="relative flex min-h-screen flex-col items-center px-4 py-10">
      <BackHome className="absolute left-4 top-4 sm:left-6 sm:top-6" />
      <Logo />
      <div className="mt-10 w-full max-w-lg">
        <SecretViewer slug={slug} />
      </div>
      <p className="mt-8 text-xs text-ink-faint">{t("pageFootnote")}</p>
    </main>
  );
}
