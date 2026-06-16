"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LifeBuoy,
  Mail,
  Globe,
  MessageSquare,
  UserSearch,
  Check,
  X,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { Badge, Button, Card, Textarea, cls } from "../ui";
import { Pager } from "./shared";
import { recoveryTemplate, type TemplateLang, type TemplateKind } from "@/lib/recovery-templates";
import type { Locale } from "@/i18n/locale";

type AccountSurface = {
  createdAt: string;
  lastLoginAt: string | null;
  hasTotp: boolean;
  hasPasskey: boolean;
  passkeys: { name: string | null }[];
  recentSessions: { ip: string | null; userAgent: string | null; createdAt: string }[];
  pushes: number;
};

type Request = {
  id: string;
  email: string;
  message: string;
  contact: string | null;
  status: string;
  ip: string | null;
  userAgent: string | null;
  adminNote: string | null;
  createdAt: string;
  handledAt: string | null;
  handledBy: string | null;
  accountId: string | null;
};

type StatusFilter = "pending" | "handled" | "rejected" | "all";

export function RecoveryTab({
  refreshKey,
  bump,
  onOpenAccount,
}: {
  refreshKey: number;
  bump: () => void;
  onOpenAccount: (email: string) => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState<Request[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("pending");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), status });
    fetch(`/api/admin/recovery?${params}`).then(async (res) => {
      if (res.ok && !cancelled) {
        const d = await res.json();
        setRows(d.requests);
        setTotal(d.total);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, status, refreshKey]);

  const pages = Math.max(1, Math.ceil(total / 20));
  const filters: [StatusFilter, string][] = [
    ["pending", t("recPending")],
    ["handled", t("recHandled")],
    ["rejected", t("recRejected")],
    ["all", t("filterAll")],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-ink-dim">
        <LifeBuoy className="size-4 text-accent-soft" />
        {t("recDesc")}
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
        <Card className="p-10 text-center text-sm text-ink-faint">{t("recEmpty")}</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RequestCard key={r.id} r={r} locale={locale} bump={bump} onOpenAccount={onOpenAccount} />
          ))}
        </div>
      )}

      <Pager page={page} pages={pages} onPage={setPage} countLabel={t("recCount", { count: total })} />
    </div>
  );
}

function RequestCard({
  r,
  locale,
  bump,
  onOpenAccount,
}: {
  r: Request;
  locale: Locale;
  bump: () => void;
  onOpenAccount: (email: string) => void;
}) {
  const t = useTranslations("admin");
  const [note, setNote] = useState(r.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  async function setStatus(status: "HANDLED" | "REJECTED" | "PENDING") {
    setBusy(true);
    await fetch("/api/admin/recovery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, status, adminNote: note.trim() || undefined }),
    });
    setBusy(false);
    bump();
  }

  const tone = r.status === "PENDING" ? "warn" : r.status === "HANDLED" ? "ok" : "neutral";
  const statusLabel =
    r.status === "PENDING" ? t("recPending") : r.status === "HANDLED" ? t("recHandled") : t("recRejected");

  return (
    <Card className={cls("p-4", r.status === "PENDING" && "border-warn/30")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Mail className="size-4 text-ink-faint" />
            <span className="font-medium text-ink break-all">{r.email}</span>
            <Badge tone={tone}>{statusLabel}</Badge>
            {r.accountId ? (
              <Badge tone="ok">{t("recAccountFound")}</Badge>
            ) : (
              <Badge tone="warn">{t("recNoAccount")}</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {new Date(r.createdAt).toLocaleString(locale)}
            {r.handledAt && (
              <> · {t("recHandledBy", { who: r.handledBy ?? "—", when: new Date(r.handledAt).toLocaleString(locale) })}</>
            )}
          </p>
        </div>
        {r.accountId && (
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => onOpenAccount(r.email)}>
            <UserSearch className="size-3.5" /> {t("recOpenAccount")}
          </Button>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-line bg-bg-soft/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-faint">
          <MessageSquare className="size-3.5" /> {t("recMessage")}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-dim">{r.message}</p>
        {r.contact && (
          <p className="mt-2 text-sm text-ink-dim">
            <span className="text-ink-faint">{t("recContact")} : </span>
            {r.contact}
          </p>
        )}
        {(r.ip || r.userAgent) && (
          <p className="mt-2 flex items-start gap-1.5 font-mono text-xs text-ink-faint">
            <Globe className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-all">
              {r.ip ?? "—"} · {(r.userAgent ?? "").slice(0, 80)}
            </span>
          </p>
        )}
      </div>

      {/* Inline control of the matching account (identity verification) */}
      {r.accountId && (
        <div className="mt-3">
          <button
            onClick={() => setShowAccount((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-bg-soft/40 px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink cursor-pointer"
          >
            <ShieldCheck className="size-4 text-accent-soft" />
            {t("recAccountControl")}
            <ChevronDown className={cls("ml-auto size-4 transition-transform", showAccount && "rotate-180")} />
          </button>
          {showAccount && <AccountControl accountId={r.accountId} locale={locale} />}
        </div>
      )}

      {/* Copy-paste reply templates (out-of-band email) */}
      <ReplyTemplates locale={locale} />

      <div className="mt-3 space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("recNotePlaceholder")}
          rows={2}
          maxLength={2000}
          className="text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {r.status !== "HANDLED" && (
            <Button variant="subtle" className="py-2" loading={busy} onClick={() => setStatus("HANDLED")}>
              <Check className="size-4" /> {t("recMarkHandled")}
            </Button>
          )}
          {r.status !== "REJECTED" && (
            <Button variant="ghost" className="py-2" disabled={busy} onClick={() => setStatus("REJECTED")}>
              <X className="size-4" /> {t("recReject")}
            </Button>
          )}
          {r.status !== "PENDING" && (
            <Button variant="ghost" className="py-2" disabled={busy} onClick={() => setStatus("PENDING")}>
              <RotateCcw className="size-4" /> {t("recReopen")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Verification surface of the matching account, loaded on expand. */
function AccountControl({ accountId, locale }: { accountId: string; locale: Locale }) {
  const t = useTranslations("admin");
  const [s, setS] = useState<AccountSurface | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${accountId}`).then(async (res) => {
      if (!cancelled) {
        if (res.ok) setS(await res.json());
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : "—");

  if (loading) return <p className="px-3 py-3 text-sm text-ink-faint">{t("recLoading")}</p>;
  if (!s) return <p className="px-3 py-3 text-sm text-danger">{t("genericError")}</p>;

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-line bg-bg-soft/40 p-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        <Field label={t("vCreated")} value={fmt(s.createdAt)} />
        <Field label={t("vLastLogin")} value={fmt(s.lastLoginAt)} />
        <Field label={t("vPushes")} value={String(s.pushes)} />
        <Field label={t("vTotp")} value={s.hasTotp ? t("yes") : t("no")} />
        <Field
          label={t("vPasskeys")}
          value={s.passkeys.length ? s.passkeys.map((p) => p.name || "—").join(", ") : t("no")}
        />
      </div>
      {s.recentSessions.length > 0 && (
        <div className="border-t border-line/60 pt-2">
          <p className="flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle className="size-3.5" /> {t("vDoNotDisclose")}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-dim">
            {s.recentSessions.map((x, i) => (
              <li key={i} className="font-mono">
                {new Date(x.createdAt).toLocaleString(locale)} · {x.ip ?? "—"} ·{" "}
                <span className="text-ink-faint">{(x.userAgent ?? "").slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="break-words text-ink-dim">{value}</p>
    </div>
  );
}

/** Copy-paste reply templates, language of choice (default = admin locale). */
function ReplyTemplates({ locale }: { locale: Locale }) {
  const t = useTranslations("admin");
  const [lang, setLang] = useState<TemplateLang>(locale === "fr" ? "fr" : "en");
  const [copied, setCopied] = useState<TemplateKind | null>(null);

  const kinds: [TemplateKind, string][] = [
    ["verified", t("recTplVerified")],
    ["moreInfo", t("recTplMoreInfo")],
    ["declined", t("recTplDeclined")],
  ];

  async function copy(kind: TemplateKind) {
    const tpl = recoveryTemplate(lang, kind);
    await navigator.clipboard.writeText(`${tpl.subject}\n\n${tpl.body}`);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-bg-soft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          <Mail className="size-3.5" /> {t("recTemplates")}
        </p>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(["fr", "en"] as TemplateLang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cls(
                "px-2.5 py-1 uppercase transition-colors cursor-pointer",
                lang === l ? "bg-accent/15 text-accent-soft" : "text-ink-faint hover:text-ink-dim"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">{t("recTplHint")}</p>
      <div className="mt-2 space-y-2">
        {kinds.map(([kind, label]) => {
          const tpl = recoveryTemplate(lang, kind);
          return (
            <details key={kind} className="group rounded-lg border border-line bg-panel/40">
              <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-ink-dim">{label}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    copy(kind);
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-dim transition-colors hover:text-ink cursor-pointer"
                >
                  {copied === kind ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                  {copied === kind ? t("copied") : t("recCopyReply")}
                </button>
              </summary>
              <div className="border-t border-line px-3 py-2">
                <p className="text-xs font-medium text-ink-faint">{tpl.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-dim">{tpl.body}</p>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
