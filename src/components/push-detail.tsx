"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Eye, KeyRound, ShieldOff, Flame, PlusCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button, Card, cls } from "./ui";
import { PawLoader } from "./cat";
import { CopyButton } from "./copy-button";
import { PushStatus, type OwnerPush } from "./push-list";
import { formatBytes } from "@/lib/format";
import type { Locale } from "@/i18n/locale";

type AuditEvent = {
  kind: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type Detail = OwnerPush & { events: AuditEvent[]; retrievalStep: boolean; deletableByViewer: boolean };

const EVENT_META: Record<string, { key: "eventCreated" | "eventView" | "eventFailedPassphrase" | "eventExpired" | "eventOwnerDelete" | "eventViewerDelete"; icon: typeof Eye; tone: "ok" | "warn" | "danger" | "neutral" | "accent" }> = {
  CREATED: { key: "eventCreated", icon: PlusCircle, tone: "accent" },
  VIEW: { key: "eventView", icon: Eye, tone: "ok" },
  FAILED_PASSPHRASE: { key: "eventFailedPassphrase", icon: KeyRound, tone: "warn" },
  EXPIRED: { key: "eventExpired", icon: ShieldOff, tone: "neutral" },
  OWNER_DELETE: { key: "eventOwnerDelete", icon: Trash2, tone: "danger" },
  VIEWER_DELETE: { key: "eventViewerDelete", icon: Flame, tone: "danger" },
};

const TONE_CHIP: Record<string, string> = {
  ok: "border-ok/25 bg-ok/10 text-ok",
  warn: "border-warn/25 bg-warn/10 text-warn",
  danger: "border-danger/25 bg-danger/10 text-danger",
  accent: "border-accent/25 bg-accent/10 text-accent-soft",
  neutral: "border-line bg-bg-soft text-ink-faint",
};

export function PushDetail({ slug }: { slug: string }) {
  const t = useTranslations("pushDetail");
  const tTabs = useTranslations("tabs");
  const locale = useLocale();
  const router = useRouter();
  const [push, setPush] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pushes/${slug}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) return setNotFound(true);
      setPush(await res.json());
    });
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

  async function expireNow() {
    if (!confirm(t("expireConfirm"))) return;
    setDeleting(true);
    await fetch(`/api/pushes/${slug}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
    setDeleting(false);
  }

  if (notFound) {
    return (
      <Card className="p-10 text-center text-sm text-ink-faint">
        {t("notFound")}
      </Card>
    );
  }
  if (!push) {
    return (
      <Card className="p-10 text-center">
        <PawLoader />
      </Card>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.push("/pushes")}
          className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </button>
        <PushStatus push={push} />
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold">
            {push.note || tTabs(push.kind as "PASSWORD")}
          </h1>
          <p className="mt-0.5 text-xs text-ink-faint">
            {t("meta", {
              kind: tTabs(push.kind as "PASSWORD"),
              size: push.fileSize ? ` · ${formatBytes(push.fileSize, locale as Locale)}` : "",
              date: new Date(push.createdAt).toLocaleString(locale),
            })}
          </p>
        </div>

        {!push.expired && (
          <div className="break-all rounded-xl border border-line bg-bg-soft px-4 py-3 font-mono text-xs text-accent-soft">
            {push.url}
            <span className="text-ink-faint">{t("keySuffix")}</span>
          </div>
        )}
        <p className="text-xs text-ink-faint">{t("keyNote")}</p>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone="neutral">
            {t("badgeViews", { views: push.views, max: push.expireAfterViews })}
          </Badge>
          <Badge tone="neutral">
            {t("badgeExpires", { date: new Date(push.expiresAt).toLocaleDateString(locale) })}
          </Badge>
          {push.hasPassphrase && <Badge tone="accent">{t("badgePassphrase")}</Badge>}
          {push.retrievalStep && <Badge tone="neutral">{t("badgeRetrieval")}</Badge>}
          {push.deletableByViewer && <Badge tone="neutral">{t("badgeDeletable")}</Badge>}
        </div>

        {!push.expired && (
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <CopyButton value={`${push.url}`} label={t("copyNoKey")} />
            <Button variant="danger" onClick={expireNow} loading={deleting}>
              <Trash2 className="size-4" />
              {t("expireNow")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-ink-dim">{t("auditTitle")}</h2>
        {push.events.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">{t("noEvents")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/50">
            {push.events.map((e, i) => {
              const info = EVENT_META[e.kind];
              const label = info ? t(info.key) : e.kind;
              const Icon = info?.icon ?? Eye;
              const tone = info?.tone ?? "neutral";
              return (
                <li key={i} className="flex gap-3 py-3">
                  <span
                    className={cls(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border",
                      TONE_CHIP[tone]
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="text-sm font-medium text-ink">{label}</span>
                      <time className="text-xs text-ink-faint tabular-nums">
                        {new Date(e.createdAt).toLocaleString(locale)}
                      </time>
                    </div>
                    {(e.ip || e.userAgent) && (
                      <dl className="mt-1.5 space-y-1 text-xs">
                        {e.ip && (
                          <div className="flex gap-2">
                            <dt className="w-16 shrink-0 text-ink-faint">{t("auditIp")}</dt>
                            <dd className="min-w-0 break-all font-mono text-ink-dim">{e.ip}</dd>
                          </div>
                        )}
                        {e.userAgent && (
                          <div className="flex gap-2">
                            <dt className="w-16 shrink-0 text-ink-faint">{t("auditUa")}</dt>
                            <dd className="min-w-0 break-words text-ink-dim">{e.userAgent}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
