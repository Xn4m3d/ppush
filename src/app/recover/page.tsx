import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { Header } from "@/components/header";
import { AuthBench, RecoverStage } from "@/components/auth-bench";
import { RecoverForm } from "@/components/recover-form";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return { title: t("recover"), description: t("recoverDescription"), robots: { index: false } };
}

export default async function RecoverPage() {
  if (await currentUser()) redirect("/account");
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <AuthBench stage={<RecoverStage />}>
          <RecoverForm turnstileSiteKey={config.turnstileSiteKey} />
        </AuthBench>
      </main>
    </>
  );
}
