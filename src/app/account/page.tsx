import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { currentUser, primaryAdminId } from "@/lib/auth";
import { THEME_COOKIE, effectiveChoice } from "@/lib/themes";
import { Header } from "@/components/header";
import { Card } from "@/components/ui";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  DefaultsPanel,
  PasswordPanel,
  TokensPanel,
  DeleteAccountPanel,
} from "@/components/account-panel";
import { PasskeysPanel } from "@/components/passkeys-panel";
import { TotpPanel } from "@/components/totp-panel";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("account"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const user = await currentUser();
  if (!user) redirect("/login");

  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const themeChoice = effectiveChoice(themeCookie, user.theme);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {user.name} · {user.email}
            {user.role === "ADMIN" && ` · ${t("administrator")}`}
          </p>
        </div>
        <DefaultsPanel
          initial={{
            defaultDays: user.defaultDays,
            defaultViews: user.defaultViews,
            defaultRetrievalStep: user.defaultRetrievalStep,
            defaultDeletableByViewer: user.defaultDeletableByViewer,
            autoOpenUrls: user.autoOpenUrls,
          }}
        />
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{t("themeTitle")}</h2>
          <p className="text-sm text-ink-dim">{t("themeHint")}</p>
          <ThemeSwitcher current={themeChoice} persist />
        </Card>
        <PasskeysPanel />
        <PasswordPanel hasPassword={!!user.passwordHash} />
        <TotpPanel initialEnabled={!!user.totpEnabledAt} hasPassword={!!user.passwordHash} />
        <TokensPanel />
        {user.id !== (await primaryAdminId()) && (
          <DeleteAccountPanel
            email={user.email}
            hasPassword={!!user.passwordHash}
            has2fa={!!user.totpEnabledAt}
          />
        )}
      </main>
    </>
  );
}
