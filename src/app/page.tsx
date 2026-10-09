import { getLocale, getTranslations } from "next-intl/server";
import { parseGenPrefs } from "@/lib/generator-prefs";
import { currentUser } from "@/lib/auth";
import { config, clamp } from "@/lib/config";
import { Header } from "@/components/header";
import { PushForm } from "@/components/push-form";

export async function generateMetadata() {
  return {
    description: (await getTranslations("meta"))("homeDescription"),
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const user = await currentUser();
  const ts = await getTranslations("success");
  const u = config.limits.user;
  const a = config.limits.anon;

  // "Note to send with the link" template per type: custom (account) or default.
  const shareTemplates = {
    PASSWORD: user?.shareMsgPassword || ts("shareDefaultPassword"),
    TEXT: user?.shareMsgText || ts("shareDefaultText"),
    FILE: user?.shareMsgFile || ts("shareDefaultFile"),
    URL: user?.shareMsgUrl || ts("shareDefaultUrl"),
  };

  const defaults = user
    ? {
        tier: "user" as const,
        days: clamp(user.defaultDays, 1, u.maxDays),
        views: clamp(user.defaultViews, 1, u.maxViews),
        retrievalStep: user.defaultRetrievalStep,
        deletableByViewer: user.defaultDeletableByViewer,
        maxDays: u.maxDays,
        maxFileDays: u.maxFileDays,
        maxViews: u.maxViews,
        maxFileSizeMb: u.maxFileMb,
        showNote: true,
        shareTemplates,
        generator: parseGenPrefs(user.generatorPrefs, await getLocale()),
      }
    : {
        tier: "anon" as const,
        days: a.defaultDays,
        views: a.defaultViews,
        retrievalStep: true,
        deletableByViewer: true,
        maxDays: a.maxDays,
        maxFileDays: a.maxFileDays,
        maxViews: a.maxViews,
        maxFileSizeMb: a.maxFileMb,
        showNote: false,
        shareTemplates,
      };

  return (
    <>
      <Header />
      <main className="flex w-full flex-1 flex-col">
        <PushForm
          defaults={
            user
              ? defaults
              : { ...defaults, upgrade: { maxDays: u.maxDays, maxFileDays: u.maxFileDays, maxViews: u.maxViews } }
          }
        />
      </main>
    </>
  );
}
