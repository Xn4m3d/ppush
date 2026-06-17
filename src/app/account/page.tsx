import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { currentUser, primaryAdminId } from "@/lib/auth";
import { THEME_COOKIE, effectiveChoice } from "@/lib/themes";
import { Header } from "@/components/header";
import { AccountTabs } from "@/components/account-tabs";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("account"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const ts = await getTranslations("success");
  const user = await currentUser();
  if (!user) redirect("/login");

  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const themeChoice = effectiveChoice(themeCookie, user.theme);
  const canDelete = user.id !== (await primaryAdminId());

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

        <AccountTabs
          defaults={{
            defaultDays: user.defaultDays,
            defaultViews: user.defaultViews,
            defaultRetrievalStep: user.defaultRetrievalStep,
            defaultDeletableByViewer: user.defaultDeletableByViewer,
            autoOpenUrls: user.autoOpenUrls,
          }}
          shareInitial={{
            password: user.shareMsgPassword ?? "",
            text: user.shareMsgText ?? "",
            file: user.shareMsgFile ?? "",
            url: user.shareMsgUrl ?? "",
          }}
          shareDefaults={{
            password: ts("shareDefaultPassword"),
            text: ts("shareDefaultText"),
            file: ts("shareDefaultFile"),
            url: ts("shareDefaultUrl"),
          }}
          themeChoice={themeChoice}
          hasPassword={!!user.passwordHash}
          has2fa={!!user.totpEnabledAt}
          canDelete={canDelete}
          email={user.email}
        />
      </main>
    </>
  );
}
