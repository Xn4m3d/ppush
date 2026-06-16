import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/header";
import { BackHome } from "@/components/back-home";
import { ResetForm } from "@/components/reset-form";

export async function generateMetadata() {
  return {
    title: (await getTranslations("reset"))("title"),
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12 sm:px-6">
      <BackHome className="mb-6" />
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <ResetForm />
    </main>
  );
}
