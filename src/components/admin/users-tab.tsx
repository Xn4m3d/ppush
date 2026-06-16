"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Search,
  Fingerprint,
  Crown,
  ShieldCheck,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
  LogOut,
  RotateCcw,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { Badge, Button, Card, Input, Field, cls } from "../ui";
import { Modal, Pager, CopyField } from "./shared";
import { wrapInPush } from "@/lib/push-link";
import type { Locale } from "@/i18n/locale";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  approvedAt: string | null;
  totpEnabledAt: string | null;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { pushes: number; credentials: number; sessions: number };
};

type Surface = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  hasTotp: boolean;
  hasPasskey: boolean;
  passkeys: { name: string | null; createdAt: string; lastUsedAt: string | null }[];
  apiTokens: { name: string; lastUsedAt: string | null }[];
  recentSessions: { ip: string | null; userAgent: string | null; createdAt: string }[];
  pushes: number;
  sessions: number;
  actions: { id: string; actorEmail: string; action: string; details: string | null; createdAt: string }[];
};

type Filter = "all" | "active" | "pending" | "disabled" | "admin";

type StatsUsers = {
  total: number;
  active: number;
  pending: number;
  disabled: number;
  admins: number;
};

export function UsersTab({
  selfId,
  stats,
  refreshKey,
  bump,
  seedQuery = "",
}: {
  selfId: string;
  stats: StatsUsers | null;
  refreshKey: number;
  bump: () => void;
  seedQuery?: string;
}) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  // Pre-filled from a recovery request (the tab mounts when shown).
  const [q, setQ] = useState(seedQuery);
  const [debouncedQ, setDebouncedQ] = useState(seedQuery);
  const [open, setOpen] = useState<AdminUser | null>(null);

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

  const pages = Math.max(1, Math.ceil(total / 20));
  const filters: [Filter, string, number?][] = [
    ["all", t("filterAll"), stats?.total],
    ["active", t("filterActive"), stats?.active],
    ["pending", t("filterPending"), stats?.pending],
    ["disabled", t("filterDisabled"), stats?.disabled],
    ["admin", t("filterAdmins"), stats?.admins],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-9" />
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
                filter === f ? "bg-accent/15 text-accent-soft" : "text-ink-faint hover:bg-panel hover:text-ink-dim"
              )}
            >
              {label}
              {n !== undefined && <span className="ml-1 text-xs opacity-70">{n}</span>}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-5 py-3 font-medium">{t("colUser")}</th>
                <th className="px-3 py-3 font-medium">{t("colRole")}</th>
                <th className="px-3 py-3 font-medium hidden sm:table-cell">{t("colPushes")}</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">{t("colLastLogin")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("colManage")}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-faint">
                    {t("empty")}
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className={cls("border-b border-line/50 last:border-0", !u.active && "opacity-60")}>
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
                  <td className="px-3 py-3.5 hidden md:table-cell text-xs text-ink-faint">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(locale) : t("never")}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {u.id !== selfId ? (
                      <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setOpen(u)}>
                        {t("manage")}
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-faint">{t("you")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pager page={page} pages={pages} onPage={setPage} countLabel={t("count", { count: total })} />

      {open && (
        <UserDrawer
          user={open}
          isPrimary={open.id === primaryId}
          selfIsPrimary={selfId === primaryId}
          onClose={() => setOpen(null)}
          onChanged={() => {
            bump();
          }}
          onDeleted={() => {
            setOpen(null);
            bump();
          }}
        />
      )}
    </div>
  );
}

function UserDrawer({
  user,
  isPrimary,
  selfIsPrimary,
  onClose,
  onChanged,
  onDeleted,
}: {
  user: AdminUser;
  isPrimary: boolean;
  selfIsPrimary: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [surface, setSurface] = useState<Surface | null>(null);
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const [verifiedBy, setVerifiedBy] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [totpResult, setTotpResult] = useState<"idle" | "valid" | "invalid">("idle");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteCode, setPromoteCode] = useState("");
  const [promoteErr, setPromoteErr] = useState<string | null>(null);
  const [promoteBusy, setPromoteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${user.id}`).then(async (r) => {
      if (r.ok && !cancelled) setSurface(await r.json());
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function patch(data: Record<string, unknown>) {
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, ...data }),
    });
    onChanged();
    return r;
  }

  async function confirmPromote() {
    setPromoteErr(null);
    setPromoteBusy(true);
    const r = await patch({ role: "ADMIN", totp: promoteCode });
    setPromoteBusy(false);
    if (r.ok) {
      setPromoting(false);
      setPromoteCode("");
    } else {
      const d = await r.json().catch(() => ({}));
      setPromoteErr(d.error ?? t("genericError"));
    }
  }

  async function saveEdit() {
    setEditErr(null);
    setSavingEdit(true);
    const r = await patch({
      ...(email !== user.email ? { email } : {}),
      ...(name !== user.name ? { name } : {}),
    });
    setSavingEdit(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setEditErr(d.error ?? t("genericError"));
    }
  }

  async function verifyCode() {
    const r = await fetch(`/api/admin/users/${user.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verifyTotp", code }),
    });
    const d = await r.json().catch(() => ({}));
    setTotpResult(d.valid ? "valid" : "invalid");
    if (d.valid) setVerifiedBy((v) => (v.includes("totp") ? v : [...v, "totp"]));
  }

  async function generateReset() {
    setGenErr(null);
    setGenerating(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword", id: user.id, verifiedBy: verifiedBy.length ? verifiedBy : undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "");
      const link = await wrapInPush(d.url, { minutes: 60, views: 1 });
      setResetLink(link);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setGenErr(msg === "INSECURE_CONTEXT" ? t("insecureContext") : msg || t("genericError"));
    } finally {
      setGenerating(false);
    }
  }

  async function remove() {
    if (!confirm(t("deleteConfirm", { email: user.email }))) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    });
    onDeleted();
  }

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(locale) : "—");
  const actionLabel = (a: string): string =>
    ({
      USER_DISABLE: t("actUserDisable"),
      USER_ENABLE: t("actUserEnable"),
      USER_ROLE: t("actUserRole"),
      USER_EDIT: t("actUserEdit"),
      USER_RESET_PW: t("actUserResetPw"),
      USER_RESET_2FA: t("actUserReset2fa"),
      USER_LOGOUT: t("actUserLogout"),
      USER_DELETE: t("actUserDelete"),
      RECOVERY_HANDLE: t("actRecoveryHandle"),
      RECOVERY_REJECT: t("actRecoveryReject"),
    })[a] ?? a;

  return (
    <Modal open onClose={onClose} title={t("manageTitle", { name: user.name })} wide>
      <div className="space-y-6">
        {/* Identity header */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>
            {isPrimary && <Crown className="size-3" />}
            {user.role === "ADMIN" ? t("roleAdmin") : t("roleUser")}
          </Badge>
          {!user.active && (user.approvedAt ? <Badge tone="danger">{t("deactivated")}</Badge> : <Badge tone="warn">{t("pending")}</Badge>)}
          {surface?.hasTotp && <Badge tone="ok">{t("twoFa")}</Badge>}
          {surface?.hasPasskey && <Badge tone="ok"><Fingerprint className="size-3" />{t("passkey")}</Badge>}
          {!user.hasPassword && <Badge tone="warn">{t("passkeyOnly")}</Badge>}
        </div>

        {/* Identity verification surface */}
        <section className="space-y-2 rounded-xl border border-line bg-bg-soft/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("verifSurface")}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            <Info label={t("vCreated")} value={fmtDate(surface?.createdAt ?? null)} />
            <Info label={t("vLastLogin")} value={fmtDate(surface?.lastLoginAt ?? null)} />
            <Info label={t("vPushes")} value={String(surface?.pushes ?? "—")} />
            <Info label={t("vTotp")} value={surface ? (surface.hasTotp ? t("yes") : t("no")) : "—"} />
            <Info
              label={t("vPasskeys")}
              value={surface ? (surface.passkeys.length ? surface.passkeys.map((p) => p.name || "—").join(", ") : t("no")) : "—"}
            />
            <Info
              label={t("vTokens")}
              value={surface ? (surface.apiTokens.length ? surface.apiTokens.map((k) => k.name).join(", ") : t("vNone")) : "—"}
            />
          </div>
          {surface && surface.recentSessions.length > 0 && (
            <div className="mt-2 border-t border-line/60 pt-2">
              <p className="flex items-center gap-1.5 text-xs text-warn">
                <AlertTriangle className="size-3.5" /> {t("vDoNotDisclose")}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-ink-dim">
                {surface.recentSessions.map((s, i) => (
                  <li key={i} className="font-mono">
                    {new Date(s.createdAt).toLocaleString(locale)} · {s.ip ?? "—"} ·{" "}
                    <span className="text-ink-faint">{(s.userAgent ?? "").slice(0, 60)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {surface?.hasPasskey && <p className="text-xs text-ok">{t("vHasPasskeyHint")}</p>}
        </section>

        {/* History of admin actions already performed on this account */}
        <section className="space-y-2 rounded-xl border border-line bg-bg-soft/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("adminHistory")}</p>
          {surface && surface.actions.length === 0 ? (
            <p className="text-xs text-ink-faint">{t("adminHistoryEmpty")}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(surface?.actions ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-baseline gap-x-2 border-b border-line/40 pb-1 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-ink-dim">{actionLabel(a.action)}</span>
                  <span className="text-ink-faint">{new Date(a.createdAt).toLocaleString(locale)}</span>
                  <span className="text-ink-faint">· {a.actorEmail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Password reset via ppush */}
        <section className="space-y-3 rounded-xl border border-accent/30 bg-accent/[0.05] p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-accent-soft" />
            <p className="text-sm font-semibold text-ink">{t("resetTitle")}</p>
          </div>
          <p className="text-xs text-ink-dim">{t("resetDesc")}</p>

          {/* TOTP challenge */}
          {surface?.hasTotp && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("totpChallenge")}>
                <Input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setTotpResult("idle");
                  }}
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-32 font-mono"
                />
              </Field>
              <Button variant="subtle" className="py-2.5" onClick={verifyCode} disabled={code.length < 6}>
                {t("totpVerify")}
              </Button>
              {totpResult === "valid" && <span className="pb-2.5 text-sm font-medium text-ok">{t("totpValid")}</span>}
              {totpResult === "invalid" && <span className="pb-2.5 text-sm font-medium text-danger">{t("totpInvalid")}</span>}
            </div>
          )}

          {/* Verification basis/bases used — multi-select (cumulative, recommended) */}
          <div>
            <p className="text-[13px] font-medium text-ink-dim">{t("verifiedByLabel")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  ["totp", t("vbTotp")],
                  ["passkey", t("vbPasskey")],
                  ["email", t("vbEmail")],
                  ["knowledge", t("vbKnowledge")],
                ] as [string, string][]
              ).map(([val, label]) => {
                const on = verifiedBy.includes(val);
                return (
                  <label
                    key={val}
                    className={cls(
                      "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      on
                        ? "border-accent/50 bg-accent/10 text-accent-soft"
                        : "border-line text-ink-dim hover:border-line-soft"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setVerifiedBy((v) => (v.includes(val) ? v.filter((x) => x !== val) : [...v, val]))
                      }
                      className="accent-[var(--color-accent)]"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          {!resetLink ? (
            <div className="flex items-center gap-2">
              <Button onClick={generateReset} loading={generating}>
                {t("generateLink")}
              </Button>
              {genErr && <span className="text-sm text-danger">{genErr}</span>}
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-ok/30 bg-ok/5 p-3">
              <p className="text-sm font-medium text-ink">{t("resetLinkReady")}</p>
              <p className="text-xs text-ink-dim">{t("sendToEmail", { email: user.email })}</p>
              <CopyField value={resetLink} label={t("copy")} />
            </div>
          )}
        </section>

        {/* Profile editing (rectification) */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("editTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("fieldEmail")}>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </Field>
            <Field label={t("fieldName")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          {editErr && <p className="text-sm text-danger">{editErr}</p>}
          <Button
            variant="subtle"
            loading={savingEdit}
            disabled={email === user.email && name === user.name}
            onClick={saveEdit}
          >
            {t("save")}
          </Button>
        </section>

        {/* Autres actions */}
        <section className="flex flex-wrap gap-2 border-t border-line pt-4">
          {user.role === "ADMIN" ? (
            !isPrimary && (
              <Button variant="ghost" onClick={() => patch({ role: "USER" })}>
                <ShieldCheck className="size-4" /> {t("demote")}
              </Button>
            )
          ) : !selfIsPrimary ? (
            <Button variant="ghost" disabled title={t("onlyPrimaryPromoteHint")}>
              <ShieldCheck className="size-4" /> {t("promote")}
            </Button>
          ) : promoting ? (
            <div className="flex w-full flex-wrap items-end gap-2">
              <Field label={t("promoteTotp")}>
                <Input
                  value={promoteCode}
                  onChange={(e) => {
                    setPromoteCode(e.target.value);
                    setPromoteErr(null);
                  }}
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-28 font-mono"
                />
              </Field>
              <Button
                variant="subtle"
                className="py-2.5"
                loading={promoteBusy}
                disabled={promoteCode.length < 6}
                onClick={confirmPromote}
              >
                {t("confirm")}
              </Button>
              <Button
                variant="ghost"
                className="py-2.5"
                onClick={() => {
                  setPromoting(false);
                  setPromoteErr(null);
                }}
              >
                {t("cancel")}
              </Button>
              {promoteErr && <span className="self-center text-sm text-danger">{promoteErr}</span>}
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setPromoting(true)}>
              <ShieldCheck className="size-4" /> {t("promote")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => patch({ active: !user.active })}>
            {user.active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
            {user.active ? t("deactivate") : user.approvedAt ? t("reactivate") : t("approve")}
          </Button>
          {user.active && (
            <Button
              variant="ghost"
              onClick={() => confirm(t("forceLogoutConfirm", { email: user.email })) && patch({ forceLogout: true })}
            >
              <LogOut className="size-4" /> {t("forceLogout")}
            </Button>
          )}
          {surface?.hasTotp && (
            <Button
              variant="ghost"
              onClick={() => confirm(t("resetTotpConfirm", { email: user.email })) && patch({ resetTotp: true })}
            >
              <RotateCcw className="size-4" /> {t("resetTotp")}
            </Button>
          )}
          {!isPrimary && (
            <Button variant="danger" onClick={remove}>
              <Trash2 className="size-4" /> {t("deleteUser")}
            </Button>
          )}
          {isPrimary && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
              <ShieldAlert className="size-3.5" /> {t("primaryProtected")}
            </span>
          )}
        </section>
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
