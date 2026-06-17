import Link from "next/link";
import { Sparkles, History, Eye, FileUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { config, clamp } from "@/lib/config";
import { Header } from "@/components/header";
import { PushForm } from "@/components/push-form";
import { MascotCat } from "@/components/mascot-cat";

export async function generateMetadata() {
  return {
    description: (await getTranslations("meta"))("homeDescription"),
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const user = await currentUser();
  const t = await getTranslations("home");
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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-10 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-ink-dim">{t("subtitle")}</p>
        </div>

        {!user && (
          <div className="relative mb-6 rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.10] to-accent/[0.02] animate-fade-up">
            {/* title badge: straddling the top-left border of the zone */}
            <span className="absolute -top-3 left-4 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-bg px-2.5 py-1 text-xs font-medium text-accent-soft shadow-sm">
              <Sparkles className="size-3.5" /> {t("anonBadge")}
            </span>
            <div className="px-4 pt-5 pb-3.5 sm:px-5 sm:pt-5 sm:pb-4">
              <p className="text-center text-sm text-ink-dim">
                {t("anonLimits", { days: a.maxDays, views: a.maxViews, fileMb: a.maxFileMb })}
              </p>
              <p className="mt-0.5 text-center text-sm text-ink-dim">{t("anonNoTracking")}</p>

              <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-dim">
                {t("anonUnlock")}
              </p>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {/* View tracking: the flagship argument → full width, highlighted */}
                <div className="flex flex-col items-center gap-1 text-center rounded-xl border border-accent/40 bg-accent/[0.09] px-3 py-2.5 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/15">
                      <Eye className="size-4 text-accent-soft" />
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {t("anonPerkTrackingTitle")}
                    </span>
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-soft">
                      {t("anonPerkStar")}
                    </span>
                  </div>
                  <p className="text-xs text-ink-dim">{t("anonPerkTrackingDesc")}</p>
                </div>

                <div className="flex flex-col items-center gap-1.5 text-center rounded-xl border border-line/60 bg-bg-soft/40 px-3 py-2.5">
                  <History className="size-4 shrink-0 text-accent-soft" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{t("anonPerkHistoryTitle")}</p>
                    <p className="text-xs text-ink-dim">{t("anonPerkHistoryDesc")}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 text-center rounded-xl border border-line/60 bg-bg-soft/40 px-3 py-2.5">
                  <FileUp className="size-4 shrink-0 text-accent-soft" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{t("anonPerkMoreTitle")}</p>
                    <p className="text-xs text-ink-dim">
                      {t("anonPerkMoreDesc", {
                        fileMb: u.maxFileMb,
                        days: u.maxDays,
                        views: u.maxViews,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent-soft transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/25"
                >
                  <Sparkles className="size-4" /> {t("anonCta")}
                </Link>
                <span className="text-xs text-ink-faint">{t("anonCtaNote")}</span>
              </div>
            </div>
          </div>
        )}

        <PushForm defaults={defaults} />

        {/* Home mascot: decorative, pushed to the bottom to sit on the footer's
            top border. translate-y makes it bite the line a little; z-10 (on a
            relative parent) brings it IN FRONT of the footer, so the wagging
            tail sweeps over the border, not behind it. */}
        <div className="relative z-10 mt-auto flex translate-y-1.5 justify-center pt-12">
          <MascotCat />
        </div>
      </main>
    </>
  );
}
