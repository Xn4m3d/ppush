"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ShieldCheck,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
  Search,
  Fingerprint,
  Crown,
} from "lucide-react";
import { Badge, Card, Input, cls } from "./ui";
import { formatBytes } from "@/lib/format";
import type { Locale } from "@/i18n/locale";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  approvedAt: string | null;
  totpEnabledAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { pushes: number; credentials: number };
};

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
  pushes: { total: number; active: number; expired: number; files: number };
  storage: { usedBytes: number; availableBytes: number };
};

type Filter = "all" | "active" | "pending" | "disabled" | "admin";

export function AdminPanel({ selfId }: { selfId: string }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // search debounce (setState in a timer → lint-compliant)
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stats").then(async (res) => {
      if (res.ok && !cancelled) setStats(await res.json());
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page) });
    if (filter !== "all") params.set("filter", filter);
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/admin/users?${params}`).then(async (res) => {
      if (res.ok && !cancelled) {
        const d = await res.json();
        setUsers(d.users);
        setTotal(d.total);
        setPrimaryId(d.primaryAdminId ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, filter, debouncedQ, refreshKey]);

  async function patch(
    id: string,
    data: { active?: boolean; role?: string; resetTotp?: boolean }
  ) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    setRefreshKey((k) => k + 1);
  }

  async function remove(u: AdminUser) {
    if (!confirm(t("deleteConfirm", { email: u.email }))) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id }),
    });
    setRefreshKey((k) => k + 1);
  }

  const pages = Math.max(1, Math.ceil(total / 20));
  const filters: [Filter, string, number?][] = [
    ["all", t("filterAll"), stats?.users.total],
    ["active", t("filterActive"), stats?.users.active],
    ["pending", t("filterPending"), stats?.users.pending],
    ["disabled", t("filterDisabled"), stats?.users.disabled],
    ["admin", t("filterAdmins"), stats?.users.admins],
  ];

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {t("statAccounts")}
            </p>
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
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {t("statContent")}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label={t("statPushes")} value={stats.pushes.total} />
              <Stat label={t("statPushesActive")} value={stats.pushes.active} tone="ok" />
              <Stat label={t("statFiles")} value={stats.pushes.files} />
              <div className="col-span-3 mt-1 border-t border-line/60 pt-2 text-xs text-ink-faint">
                {t("statStorage")} :{" "}
                <span className="font-semibold text-ink-dim tabular-nums">
                  {formatBytes(stats.storage.usedBytes, locale)}
                </span>{" "}
                / {formatBytes(stats.storage.usedBytes + stats.storage.availableBytes, locale)}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Recherche + filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map(([f, label, n]) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={cls(
                "rounded-xl px-3 py-1.5 text-sm transition-colors cursor-pointer",
                filter === f
                  ? "bg-accent/15 text-accent-soft"
                  : "text-ink-faint hover:bg-panel hover:text-ink-dim"
              )}
            >
              {label}
              {n !== undefined && <span className="ml-1 text-xs opacity-70">{n}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-5 py-3 font-medium">{t("colUser")}</th>
                <th className="px-3 py-3 font-medium">{t("colRole")}</th>
                <th className="px-3 py-3 font-medium hidden sm:table-cell">{t("colPushes")}</th>
                <th className="px-3 py-3 font-medium hidden lg:table-cell">{t("colCreated")}</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">{t("colLastLogin")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-ink-faint">
                    {t("empty")}
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={cls("border-b border-line/50 last:border-0", !u.active && "opacity-60")}
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-xs text-ink-faint break-all">{u.email}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={u.role === "ADMIN" ? "accent" : "neutral"}>
                        {u.id === primaryId && <Crown className="size-3" />}
                        {u.role === "ADMIN" ? t("roleAdmin") : t("roleUser")}
                      </Badge>
                      {!u.active &&
                        (u.approvedAt ? (
                          <Badge tone="danger">{t("deactivated")}</Badge>
                        ) : (
                          <Badge tone="warn">{t("pending")}</Badge>
                        ))}
                      {u.totpEnabledAt && <Badge tone="ok">{t("twoFa")}</Badge>}
                      {u._count.credentials > 0 && (
                        <Badge tone="ok">
                          <Fingerprint className="size-3" />
                          {u._count.credentials}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 hidden sm:table-cell tabular-nums">{u._count.pushes}</td>
                  <td className="px-3 py-3.5 hidden lg:table-cell text-xs text-ink-faint">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-3 py-3.5 hidden md:table-cell text-xs text-ink-faint">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(locale) : t("never")}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {u.id !== selfId && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => patch(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}
                          title={u.role === "ADMIN" ? t("demote") : t("promote")}
                          className="grid size-8 place-items-center rounded-lg border border-line text-ink-faint transition-colors hover:text-accent-soft cursor-pointer"
                        >
                          <ShieldCheck className="size-4" />
                        </button>
                        <button
                          onClick={() => patch(u.id, { active: !u.active })}
                          title={
                            u.active ? t("deactivate") : u.approvedAt ? t("reactivate") : t("approve")
                          }
                          className={cls(
                            "grid size-8 place-items-center rounded-lg border border-line transition-colors cursor-pointer",
                            u.active ? "text-ink-faint hover:text-danger" : "text-ok hover:bg-ok/10"
                          )}
                        >
                          {u.active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                        </button>
                        {u.totpEnabledAt && (
                          <button
                            onClick={() => {
                              if (confirm(t("resetTotpConfirm", { email: u.email })))
                                patch(u.id, { resetTotp: true });
                            }}
                            title={t("resetTotp")}
                            className="grid size-8 place-items-center rounded-lg border border-line text-ink-faint transition-colors hover:text-warn cursor-pointer"
                          >
                            <KeyRound className="size-4" />
                          </button>
                        )}
                        {u.id !== primaryId && (
                          <button
                            onClick={() => remove(u)}
                            title={t("deleteUser")}
                            className="grid size-8 place-items-center rounded-lg border border-line text-ink-faint transition-colors hover:text-danger hover:border-danger/40 cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-ink-faint">
        <span>{t("count", { count: total })}</span>
        {pages > 1 && (
          <div className="flex items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-40 hover:text-ink cursor-pointer"
            >
              ‹
            </button>
            <span className="tabular-nums">
              {page} / {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-40 hover:text-ink cursor-pointer"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div>
      <p
        className={cls(
          "text-2xl font-semibold tabular-nums",
          tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-ink-faint">{label}</p>
    </div>
  );
}
