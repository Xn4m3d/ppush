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
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Card, cls } from "./ui";
import { PawLoader, SleepingCat } from "./cat";

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
  const locale = useLocale();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {(
          [
            ["all", t("filterAll")],
            ["active", t("filterActive")],
            ["expired", t("filterExpired")],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            onClick={() => {
              setLoading(true);
              setFilter(f);
              setPage(1);
            }}
            className={cls(
              "rounded-xl px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
              filter === f
                ? "bg-accent/15 text-accent-soft"
                : "text-ink-faint hover:bg-panel hover:text-ink-dim"
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-faint">{t("count", { count: total })}</span>
      </div>

      {loading ? (
        <Card className="p-10 text-center">
          <PawLoader />
        </Card>
      ) : pushes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-faint">
          <div className="mb-4">
            <SleepingCat />
          </div>
          {t("empty", { filter })}
        </Card>
      ) : (
        <div className="space-y-2">
          {pushes.map((p) => {
            const Icon = KIND_ICON[p.kind] ?? FileText;
            return (
              <Link
                key={p.id}
                href={`/pushes/${p.slug}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-panel/60 px-4 py-3.5 transition-colors hover:border-line-soft hover:bg-panel"
              >
                <span
                  className={cls(
                    "grid size-10 shrink-0 place-items-center rounded-xl border",
                    p.expired
                      ? "border-line bg-bg-soft text-ink-faint"
                      : "border-accent/25 bg-accent/10 text-accent-soft"
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
  );
}
