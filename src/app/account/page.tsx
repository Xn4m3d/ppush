import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { currentUser, primaryAdminId } from "@/lib/auth";
import { THEME_COOKIE, effectiveChoice } from "@/lib/themes";
import { Header } from "@/components/header";
import { AccountTabs } from "@/components/account-tabs";
import { parseGenPrefs } from "@/lib/generator-prefs";
import { PageHead } from "@/components/page-head";

export async function generateMetadata() {
  return {
    title: (await getTranslations("meta"))("account"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const ts = await getTranslations("success");
  const th = await getTranslations("pageHead");
  const user = await currentUser();
  if (!user) redirect("/login");

  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const themeChoice = effectiveChoice(themeCookie, user.theme);
  const canDelete = user.id !== (await primaryAdminId());

  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <PageHead
          eyebrow={th("account")}
          title={t("title")}
          meta={
            <>
              <span><b>{user.name}</b></span>
              <span>{user.email}</span>
              {user.role === "ADMIN" && <span>{t("administrator")}</span>}
            </>
          }
          cap={th("accountCap")}
        />
        <div className="wrap pane glass app">
        <AccountTabs
          generator={parseGenPrefs(user.generatorPrefs, await getLocale())}
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
          name={user.name}
        />
        </div>
      </main>
    </>
  );
}
