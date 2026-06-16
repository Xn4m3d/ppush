"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Trash2, ExternalLink, Eye, FileUp, Lock } from "lucide-react";
import { Badge, Button, Card, Input } from "../ui";
import { Modal, Pager } from "./shared";
import { formatBytes } from "@/lib/format";
import type { Locale } from "@/i18n/locale";

type AdminPush = {
  id: string;
  slug: string;
  kind: string;
  url: string;
  ownerEmail: string | null;
  anon: boolean;
  views: number;
  expireAfterViews: number;
  fileSize: number | null;
  hasPassphrase: boolean;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  expireReason: string | null;
  events: number;
};

export function PushesTab({ refreshKey, bump }: { refreshKey: number; bump: () => void }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [pushes, setPushes] = useState<AdminPush[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<AdminPush | null>(null);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page) });
    if (debouncedQ) params.set("q", debouncedQ);
    if (owner !== "all") params.set("owner", owner);
    if (kind !== "all") params.set("kind", kind);
    if (status !== "all") params.set("status", status);
    fetch(`/api/admin/pushes?${params}`).then(async (res) => {
      if (res.ok && !cancelled) {
        const d = await res.json();
        setPushes(d.pushes);
        setTotal(d.total);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedQ, owner, kind, status, refreshKey, localKey]);

  const pages = Math.max(1, Math.ceil(total / 20));
  const kindLabel = (k: string) =>
    k === "PASSWORD" ? t("kindPassword") : k === "TEXT" ? t("kindText") : k === "FILE" ? t("kindFile") : t("kindUrl");
  const select = (v: string, set: (s: string) => void, opts: [string, string][]) => (
    <select
      value={v}
      onChange={(e) => {
        set(e.target.value);
        setPage(1);
      }}
      className="rounded-xl border border-line bg-bg-soft px-3 py-2 text-sm text-ink-dim focus:border-accent/60 focus:outline-none cursor-pointer"
    >
      {opts.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("pSearch")} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {select(owner, setOwner, [
            ["all", t("ownerAll")],
            ["anon", t("ownerAnon")],
            ["account", t("ownerAccount")],
          ])}
          {select(kind, setKind, [
            ["all", t("kindAll")],
            ["PASSWORD", t("kindPassword")],
            ["TEXT", t("kindText")],
            ["FILE", t("kindFile")],
            ["URL", t("kindUrl")],
          ])}
          {select(status, setStatus, [
            ["all", t("statusAll")],
            ["active", t("statusActive")],
            ["expired", t("statusExpired")],
            ["file", t("statusFile")],
          ])}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-5 py-3 font-medium">{t("colSlug")}</th>
                <th className="px-3 py-3 font-medium">{t("colOwner")}</th>
                <th className="px-3 py-3 font-medium hidden sm:table-cell">{t("colViews")}</th>
                <th className="px-3 py-3 font-medium hidden lg:table-cell">{t("colCreated")}</th>
                <th className="px-3 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("colManage")}</th>
              </tr>
            </thead>
            <tbody>
              {pushes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-ink-faint">
                    {t("pEmpty")}
                  </td>
                </tr>
              )}
              {pushes.map((p) => (
                <tr key={p.id} className="border-b border-line/50 last:border-0">
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink">
                      {p.kind === "FILE" ? <FileUp className="size-3.5 text-ink-faint" /> : null}
                      {p.slug}
                    </span>
                    <p className="text-[11px] text-ink-faint">{kindLabel(p.kind)}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    {p.anon ? (
                      <Badge tone="neutral">{t("anonBadge")}</Badge>
                    ) : (
                      <span className="text-xs text-ink-dim break-all">{p.ownerEmail}</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 hidden sm:table-cell tabular-nums text-ink-dim">
                    {p.views}/{p.expireAfterViews}
                  </td>
                  <td className="px-3 py-3.5 hidden lg:table-cell text-xs text-ink-faint">
                    {new Date(p.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-3 py-3.5">
                    {p.expired ? (
                      <Badge tone="neutral">{t("statusExpired")}</Badge>
                    ) : (
                      <Badge tone="ok">{t("statusActive")}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setOpen(p)}>
                      {t("pDetail")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pager page={page} pages={pages} onPage={setPage} countLabel={t("pCount", { count: total })} />

      {open && (
        <PushDrawer
          push={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setLocalKey((k) => k + 1);
            bump();
          }}
        />
      )}
    </div>
  );
}

function PushDrawer({
  push,
  onClose,
  onChanged,
}: {
  push: AdminPush;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [detail, setDetail] = useState<{
    push: AdminPush & { expireAfterMinutes: number; deletableByViewer: boolean; retrievalStep: boolean };
    events: { id: string; kind: string; ip: string | null; userAgent: string | null; createdAt: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const kindLabel = (k: string) =>
    k === "PASSWORD" ? t("kindPassword") : k === "TEXT" ? t("kindText") : k === "FILE" ? t("kindFile") : t("kindUrl");
  const reasonLabel = (r: string) =>
    r === "VIEWS"
      ? t("reasonViews")
      : r === "TIME"
        ? t("reasonTime")
        : r === "OWNER"
          ? t("reasonOwner")
          : r === "VIEWER"
            ? t("reasonViewer")
            : t("reasonAdmin");
  const eventLabel = (k: string): string =>
    ({
      CREATED: t("eventCreated"),
      VIEW: t("eventView"),
      EXPIRED: t("eventExpired"),
      FAILED_PASSPHRASE: t("eventFailedPass"),
      OWNER_DELETE: t("eventOwnerDelete"),
      VIEWER_DELETE: t("eventViewerDelete"),
    })[k] ?? k;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/pushes/${push.id}`).then(async (r) => {
      if (r.ok && !cancelled) setDetail(await r.json());
    });
    return () => {
      cancelled = true;
    };
  }, [push.id]);

  async function takedown() {
    if (!confirm(t("takedownConfirm", { slug: push.slug }))) return;
    setBusy(true);
    await fetch("/api/admin/pushes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: push.id }),
    });
    setBusy(false);
    onChanged();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={t("pDetailTitle", { slug: push.slug })} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{kindLabel(push.kind)}</Badge>
          {push.anon ? <Badge tone="neutral">{t("anonBadge")}</Badge> : <Badge tone="ok">{push.ownerEmail}</Badge>}
          {push.expired ? <Badge tone="neutral">{t("statusExpired")}</Badge> : <Badge tone="ok">{t("statusActive")}</Badge>}
          {push.hasPassphrase && (
            <Badge tone="warn">
              <Lock className="size-3" /> {t("passphrase")}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-line bg-bg-soft/40 p-4 text-sm sm:grid-cols-3">
          <Info label={t("colViews")} value={`${push.views}/${push.expireAfterViews}`} />
          <Info label={t("vCreated")} value={new Date(push.createdAt).toLocaleString(locale)} />
          <Info label={t("pExpires")} value={new Date(push.expiresAt).toLocaleString(locale)} />
          {push.fileSize != null && <Info label={t("pFileSize")} value={formatBytes(push.fileSize, locale)} />}
          {push.expireReason && <Info label={t("pReason")} value={reasonLabel(push.expireReason)} />}
          <Info label={t("pAudit")} value={String(push.events)} />
        </div>

        <a
          href={push.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent-soft hover:underline"
        >
          <ExternalLink className="size-3.5" /> {push.url}
        </a>
        <p className="text-xs text-ink-faint">{t("noContent")}</p>

        {/* Timeline d'audit */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("auditTimeline")}</p>
          <ul className="space-y-1.5 text-xs">
            {(detail?.events ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-line/40 pb-1.5">
                <Eye className="size-3 text-ink-faint" />
                <span className="font-medium text-ink-dim">{eventLabel(e.kind)}</span>
                <span className="text-ink-faint">{new Date(e.createdAt).toLocaleString(locale)}</span>
                {e.ip && <span className="font-mono text-ink-faint">{e.ip}</span>}
                {e.userAgent && <span className="text-ink-faint">{e.userAgent.slice(0, 50)}</span>}
              </li>
            ))}
            {detail && detail.events.length === 0 && <li className="text-ink-faint">{t("noEvents")}</li>}
          </ul>
        </section>

        <div className="flex justify-end border-t border-line pt-4">
          {!push.expired ? (
            <Button variant="danger" loading={busy} onClick={takedown}>
              <Trash2 className="size-4" /> {t("takedown")}
            </Button>
          ) : (
            <span className="text-xs text-ink-faint">{t("alreadyExpired")}</span>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="break-words text-ink-dim">{value}</p>
    </div>
  );
}
