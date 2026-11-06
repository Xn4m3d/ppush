"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  FileText,
  FileUp,
  Link2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Card, CondenseLoader, cls } from "./ui";
import { MiniCloud } from "./diffusion/mini-cloud";
import { useLocalePath } from "@/i18n/use-locale-path";

export type OwnerPush = {
  id: string;
  slug: string;
  kind: string;
  note: string | null;
  url: string;
  views: number;
  expireAfterViews: number;
  expireAfterMinutes: number;
  hasPassphrase: boolean;
  fileSize: number | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  expireReason: string | null;
};

export const KIND_ICON: Record<string, typeof KeyRound> = {
  PASSWORD: KeyRound,
  TEXT: FileText,
  FILE: FileUp,
  URL: Link2,
};



export function PushStatus({ push }: { push: OwnerPush }) {
  const t = useTranslations("pushes");
  if (push.expired) {
    const reason =
      push.expireReason === "VIEWS"
        ? t("reasonViews")
        : push.expireReason === "OWNER"
          ? t("reasonOwner")
          : push.expireReason === "VIEWER"
            ? t("reasonViewer")
            : t("reasonExpired");
    return <Badge tone="danger">{reason}</Badge>;
  }
  return (
    <Badge tone="ok">
      {t("statusActive", { views: push.views, max: push.expireAfterViews })}
    </Badge>
  );
}

export function PushList() {
  const t = useTranslations("pushes");
  const tTabs = useTranslations("tabs");
  const tNav = useTranslations("header.nav");
  const locale = useLocale();
  const lp = useLocalePath();
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [pushes, setPushes] = useState<OwnerPush[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page) });
    if (filter !== "all") params.set("filter", filter);
    fetch(`/api/pushes?${params}`).then(async (res) => {
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setPushes(data.pushes);
        setTotal(data.total);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [page, filter]);

  const pages = Math.max(1, Math.ceil(total / 20));

  // "account" template: filters in the left column, links as rows between hairlines
  return (
    <>
    <aside className="side">
      <div>
        <p className="eyebrow side-label">{t("filterLabel")}</p>
        <ul>
          {(
            [
              ["all", t("filterAll")],
              ["active", t("filterActive")],
              ["expired", t("filterExpired")],
            ] as const
          ).map(([f, label]) => (
            <li key={f}>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setFilter(f);
                  setPage(1);
                }}
                aria-current={filter === f ? "true" : undefined}
                className="side-item"
              >
                {label}
                {filter === f && !loading && <small>{total}</small>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={lp("/")}
        className="inline-flex items-center gap-2 self-start rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-soft"
      >
        <Plus className="size-4" />
        {tNav("new")}
      </Link>
    </aside>
    <div className="app-main space-y-4">
      <p className="text-xs text-ink-faint">{t("count", { count: total })}</p>

      {loading ? (
        <Card className="p-10 text-center">
          <CondenseLoader />
        </Card>
      ) : pushes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-faint">
          <div className="mb-4">
            <MiniCloud />
          </div>
          {t("empty", { filter })}
        </Card>
      ) : (
        <div className="border-t border-line">
          {pushes.map((p) => {
            const Icon = KIND_ICON[p.kind] ?? FileText;
            return (
              <Link
                key={p.id}
                href={`/pushes/${p.slug}`}
                className="flex items-center gap-4 border-b border-line px-1 py-3.5 transition-colors hover:bg-ink/[0.03]"
              >
                <span
                  className={cls(
                    "grid size-10 shrink-0 place-items-center rounded-full border border-dashed",
                    p.expired
                      ? "border-line-soft text-ink-faint"
                      : "border-accent/45 text-accent-soft"
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {p.note || tTabs(p.kind as "PASSWORD")}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {t("createdOn", {
                      kind: tTabs(p.kind as "PASSWORD"),
                      date: new Date(p.createdAt).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    })}
                  </p>
                </div>
                <PushStatus push={p} />
              </Link>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => { setLoading(true); setPage(page - 1); }}
            className="grid size-8 place-items-center rounded-lg border border-line text-ink-dim disabled:opacity-40 hover:text-ink cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-ink-faint">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => { setLoading(true); setPage(page + 1); }}
            className="grid size-8 place-items-center rounded-lg border border-line text-ink-dim disabled:opacity-40 hover:text-ink cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
    </>
  );
}
