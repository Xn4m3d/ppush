"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flag, ShieldAlert, ShieldCheck, Trash2, X, RotateCcw } from "lucide-react";
import { Badge, Button, Card, cls } from "../ui";
import { Pager } from "./shared";
import { formatBytes } from "@/lib/format";
import type { Locale } from "@/i18n/locale";
import type { ReportReason } from "@/lib/reports";

type Report = {
  id: string;
  slug: string;
  reason: ReportReason;
  comment: string | null;
  ip: string | null;
  status: "PENDING" | "HANDLED" | "DISMISSED";
  createdAt: string;
  handledAt: string | null;
  handledBy: string | null;
  reportsOnLink: number;
  push: { id: string; kind: string; anon: boolean; gone: boolean; createdAt: string; expiresAt: string; source: string } | null;
};

type Guard = {
  shieldActive: boolean;
  shieldUntil: string | null;
  turnstile: boolean;
  alerts: boolean;
  anonPushesThisHour: number;
  anonBlobsThisHour: number;
  allPushesThisHour: number;
  diskFreeMb: number;
  thresholds: {
    shieldAnonPushesPerHour: number;
    closeAnonPushesPerHour: number;
    shieldAnonBlobsPerHour: number;
    closeAnonBlobsPerHour: number;
    closeAllPushesPerHour: number;
    diskMinFreeAnonMb: number;
    diskMinFreeMb: number;
  };
};

type StatusFilter = "pending" | "handled" | "dismissed" | "all";

/**
 * Abuse reports (link by link) and the anti-spam safeguards' status. No
 * link to /p/… here: opening it would use up one of the recipient's views.
 */
export function ReportsTab({ refreshKey, bump }: { refreshKey: number; bump: () => void }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState<Report[]>([]);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("pending");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), status });
    fetch(`/api/admin/reports?${params}`).then(async (res) => {
      if (res.ok && !cancelled) {
        const d = await res.json();
        setRows(d.reports);
        setTotal(d.total);
        setGuard(d.guard);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, status, refreshKey]);

  const filters: [StatusFilter, string][] = [
    ["pending", t("repPending")],
    ["handled", t("repHandled")],
    ["dismissed", t("repDismissed")],
    ["all", t("filterAll")],
  ];

  return (
    <div className="space-y-5">
      {guard && <GuardCard g={guard} locale={locale} />}

      <div className="flex items-center gap-2 text-sm text-ink-dim">
        <Flag className="size-4 text-accent-soft" />
        {t("repDesc")}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map(([f, label]) => (
          <button
            key={f}
            onClick={() => {
              setStatus(f);
              setPage(1);
            }}
            className={cls(
              "rounded-xl px-3 py-1.5 text-sm transition-colors cursor-pointer",
              status === f ? "bg-accent/15 text-accent-soft" : "text-ink-faint hover:bg-panel hover:text-ink-dim"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-faint">{t("repEmpty")}</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReportCard key={r.id} r={r} locale={locale} bump={bump} />
          ))}
        </div>
      )}

      <Pager page={page} pages={Math.max(1, Math.ceil(total / 20))} onPage={setPage} countLabel={t("repCount", { count: total })} />
    </div>
  );
}

function GuardCard({ g, locale }: { g: Guard; locale: Locale }) {
  const t = useTranslations("admin");
  const th = g.thresholds;
  const mb = (n: number) => formatBytes(n * 1_048_576, locale);
  const diskLow = g.diskFreeMb < th.diskMinFreeAnonMb;
  return (
    <Card className={cls("space-y-2 p-4 text-sm", (g.shieldActive || diskLow) && "border-warn/40")}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        {g.shieldActive ? <ShieldAlert className="size-4 text-warn" /> : <ShieldCheck className="size-4 text-ok" />}
        {g.shieldActive
          ? t("guardShieldOn", { time: new Date(g.shieldUntil!).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })
          : t("guardShieldOff")}
      </p>
      <ul className="space-y-1 text-ink-dim">
        <li>{t("guardAnonPushes", { n: g.anonPushesThisHour, shield: th.shieldAnonPushesPerHour, close: th.closeAnonPushesPerHour })}</li>
        <li>{t("guardAnonBlobs", { n: g.anonBlobsThisHour, shield: th.shieldAnonBlobsPerHour, close: th.closeAnonBlobsPerHour })}</li>
        <li>{t("guardAll", { n: g.allPushesThisHour, close: th.closeAllPushesPerHour })}</li>
        <li className={cls(diskLow && "text-warn")}>
          {t("guardDisk", { free: mb(g.diskFreeMb), anon: mb(th.diskMinFreeAnonMb), all: mb(th.diskMinFreeMb) })}
        </li>
        <li className={cls(!g.turnstile && "text-warn")}>{g.turnstile ? t("guardTurnstileOn") : t("guardTurnstileOff")}</li>
        <li>{g.alerts ? t("guardAlertsOn") : t("guardAlertsOff")}</li>
      </ul>
    </Card>
  );
}

function ReportCard({ r, locale, bump }: { r: Report; locale: Locale; bump: () => void }) {
  const t = useTranslations("admin");
  const tr = useTranslations("report");
  const [busy, setBusy] = useState(false);
  const date = (d: string) => new Date(d).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

  async function setStatus(status: Report["status"]) {
    setBusy(true);
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, status }),
    }).catch(() => null);
    setBusy(false);
    bump();
  }

  async function takedown() {
    if (!r.push || !confirm(t("repTakedownConfirm", { slug: r.slug }))) return;
    setBusy(true);
    const res = await fetch("/api/admin/pushes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.push.id }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) await setStatus("HANDLED");
  }

  const linkState = !r.push ? t("repLinkMissing") : r.push.gone ? t("repLinkGone") : t("repLinkActive");

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={r.reason === "OTHER" || r.reason === "SPAM" ? "warn" : "danger"}>{tr(`reason${r.reason}`)}</Badge>
          <code className="font-mono text-xs text-ink">/p/{r.slug}</code>
          {r.reportsOnLink > 1 && <span className="text-xs font-semibold text-warn">{t("repOnLink", { count: r.reportsOnLink })}</span>}
        </div>
        <span className="text-xs text-ink-faint">{date(r.createdAt)}</span>
      </div>
      {r.comment && <p className="whitespace-pre-wrap rounded-lg bg-bg-soft px-3 py-2 text-sm text-ink-dim">{r.comment}</p>}
      <p className="text-xs text-ink-faint">
        {linkState}
        {r.push && <> · {r.push.kind} · {r.push.anon ? t("repAnon") : t("repAccount")} · {t("repCreated", { date: date(r.push.createdAt) })}</>}
        {r.ip && <> · IP {r.ip}</>}
      </p>
      {r.status !== "PENDING" ? (
        <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
          <span>{t(r.status === "HANDLED" ? "repHandledBy" : "repDismissedBy", { who: r.handledBy ?? "?", date: r.handledAt ? date(r.handledAt) : "" })}</span>
          <Button variant="subtle" loading={busy} onClick={() => void setStatus("PENDING")}>
            <RotateCcw className="size-4" /> {t("repReopen")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="subtle" loading={busy} onClick={() => void setStatus("DISMISSED")}>
            <X className="size-4" /> {t("repDismiss")}
          </Button>
          {r.push && !r.push.gone ? (
            <Button variant="danger" loading={busy} onClick={() => void takedown()}>
              <Trash2 className="size-4" /> {t("repTakedown")}
            </Button>
          ) : (
            <Button loading={busy} onClick={() => void setStatus("HANDLED")}>{t("repMarkHandled")}</Button>
          )}
        </div>
      )}
    </Card>
  );
}
