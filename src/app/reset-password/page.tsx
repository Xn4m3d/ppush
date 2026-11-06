import { getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { AuthBench, AccountStage } from "@/components/auth-bench";
import { ResetForm } from "@/components/reset-form";

export async function generateMetadata() {
  return {
    title: (await getTranslations("reset"))("title"),
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordPage() {
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <AuthBench stage={<AccountStage />}>
          <ResetForm />
        </AuthBench>
      </main>
    </>
  );
}
