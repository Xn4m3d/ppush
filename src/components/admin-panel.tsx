"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, cls } from "./ui";
import { formatBytes } from "@/lib/format";
import { Stat } from "./admin/shared";
import { OverviewTab } from "./admin/overview-tab";
import { UsersTab } from "./admin/users-tab";
import { PushesTab } from "./admin/pushes-tab";
import { ActivityTab } from "./admin/activity-tab";
import { RecoveryTab } from "./admin/recovery-tab";
import { TipsTab } from "./admin/tips-tab";
import type { Locale } from "@/i18n/locale";

type Stats = {
  users: {
    total: number;
    active: number;
    pending: number;
    disabled: number;
    admins: number;
    with2fa: number;
    withPasskey: number;
  };
  pushes: {
    total: number;
    active: number;
    expired: number;
    files: number;
    anon: number;
    anonActive: number;
    views: number;
    bySource: { web: number; api: number; anon: number };
    apiActive: number;
    topApiTokens: { name: string; count: number }[];
  };
  storage: { usedBytes: number; availableBytes: number };
  recovery: { pending: number };
};

type Tab = "overview" | "accounts" | "requests" | "pushes" | "activity" | "tips";

export function AdminPanel({ selfId }: { selfId: string }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);
  const [tab, setTab] = useState<Tab>("overview");
  // Search pre-filled for the Accounts tab (from a recovery request).
  // UsersTab (re)mounts when the tab is shown → initialize it on mount.
  const [usersSeed, setUsersSeed] = useState("");
  const openAccount = (email: string) => {
    setUsersSeed(email);
    setTab("accounts");
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stats").then(async (res) => {
      if (res.ok && !cancelled) setStats(await res.json());
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const pendingRecovery = stats?.recovery.pending ?? 0;
  const tabs: [Tab, string, number?][] = [
    ["overview", t("tabOverview")],
    ["accounts", t("tabAccounts")],
    ["requests", t("tabRequests"), pendingRecovery],
    ["pushes", t("tabPushes")],
    ["activity", t("tabActivity")],
    ["tips", t("tabTips")],
  ];

  return (
    <div className="space-y-6">
      {stats && (
        <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("statAccounts")}</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label={t("statTotal")} value={stats.users.total} />
              <Stat label={t("statActive")} value={stats.users.active} tone="ok" />
              <Stat
                label={t("statPending")}
                value={stats.users.pending}
                tone={stats.users.pending > 0 ? "warn" : undefined}
              />
              <Stat label={t("statAdmins")} value={stats.users.admins} />
              <Stat label={t("stat2fa")} value={stats.users.with2fa} />
              <Stat label={t("statPasskey")} value={stats.users.withPasskey} />
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("statContent")}</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label={t("statPushes")} value={stats.pushes.total} />
              <Stat label={t("statPushesActive")} value={stats.pushes.active} tone="ok" />
              <Stat label={t("statAnon")} value={stats.pushes.anon} tone="accent" />
              <Stat label={t("statFiles")} value={stats.pushes.files} />
              <Stat label={t("statViews")} value={stats.pushes.views} />
              <div className="flex flex-col justify-end text-xs text-ink-faint">
                {t("statStorage")}
                <span className="font-semibold text-ink-dim tabular-nums">
                  {formatBytes(stats.storage.usedBytes, locale)} /{" "}
                  {formatBytes(stats.storage.usedBytes + stats.storage.availableBytes, locale)}
                </span>
              </div>
            </div>
          </Card>
        </div>
        <SourceBreakdown p={stats.pushes} />
        </>
      )}

      <div className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map(([id, label, badge]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setUsersSeed(""); // manual navigation: forget the pre-filled search
            }}
            className={cls(
              "relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
              tab === id ? "text-ink" : "text-ink-faint hover:text-ink-dim"
            )}
          >
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="grid min-w-[1.25rem] place-items-center rounded-full bg-warn/20 px-1.5 text-[11px] font-semibold tabular-nums text-warn">
                {badge}
              </span>
            )}
            {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab refreshKey={refreshKey} />}
      {tab === "accounts" && (
        <UsersTab
          selfId={selfId}
          stats={stats?.users ?? null}
          refreshKey={refreshKey}
          bump={bump}
          seedQuery={usersSeed}
        />
      )}
      {tab === "requests" && (
        <RecoveryTab refreshKey={refreshKey} bump={bump} onOpenAccount={openAccount} />
      )}
      {tab === "pushes" && <PushesTab refreshKey={refreshKey} bump={bump} />}
      {tab === "activity" && <ActivityTab refreshKey={refreshKey} />}
      {tab === "tips" && <TipsTab refreshKey={refreshKey} bump={bump} />}
    </div>
  );
}

/** Push origin breakdown (WEB / API / ANON) + top API tokens. */
function SourceBreakdown({ p }: { p: Stats["pushes"] }) {
  const t = useTranslations("admin");
  const tot = Math.max(1, p.bySource.web + p.bySource.api + p.bySource.anon);
  const rows: [string, number, string][] = [
    [t("sourceWeb"), p.bySource.web, "bg-accent"],
    [t("sourceApi"), p.bySource.api, "bg-warn"],
    [t("sourceAnon"), p.bySource.anon, "bg-ink-faint"],
  ];
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("sourceBreakdown")}</p>
        <p className="text-[11px] text-ink-faint">
          {t("sourceApiShare", { pct: Math.round((p.bySource.api / tot) * 100) })}
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, n, bar]) => {
          const pct = Math.round((n / tot) * 100);
          return (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-ink-dim">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-soft">
                <div className={cls("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-ink-faint">
                {n} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
      {p.topApiTokens.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("topApiTokens")}
          </p>
          <ul className="space-y-1 text-sm">
            {p.topApiTokens.map((tk) => (
              <li key={tk.name} className="flex items-center justify-between gap-3">
                <span className="break-all font-mono text-xs text-ink-dim">{tk.name}</span>
                <span className="shrink-0 tabular-nums text-ink-faint">{tk.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
