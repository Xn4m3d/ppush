"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Card } from "../ui";
import { Pager } from "./shared";
import type { Locale } from "@/i18n/locale";

type Entry = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetLabel: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
};

export function ActivityTab({ refreshKey }: { refreshKey: number }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/activity?page=${page}`).then(async (r) => {
      if (r.ok && !cancelled) {
        const d = await r.json();
        setEntries(d.entries);
        setTotal(d.total);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  const pages = Math.max(1, Math.ceil(total / 30));
  const label = (a: string): string =>
    ({
      USER_DISABLE: t("actUserDisable"),
      USER_ENABLE: t("actUserEnable"),
      USER_ROLE: t("actUserRole"),
      USER_EDIT: t("actUserEdit"),
      USER_RESET_PW: t("actUserResetPw"),
      USER_RESET_2FA: t("actUserReset2fa"),
      USER_LOGOUT: t("actUserLogout"),
      USER_DELETE: t("actUserDelete"),
      PUSH_TAKEDOWN: t("actPushTakedown"),
      RECOVERY_HANDLE: t("actRecoveryHandle"),
      RECOVERY_REJECT: t("actRecoveryReject"),
    })[a] ?? a;
  const tone = (a: string): "danger" | "warn" | "ok" | "accent" | "neutral" =>
    a === "USER_DELETE" || a === "PUSH_TAKEDOWN" || a === "USER_DISABLE"
      ? "danger"
      : a === "USER_RESET_PW" || a === "USER_RESET_2FA" || a === "USER_LOGOUT"
        ? "warn"
        : a === "USER_ENABLE"
          ? "ok"
          : a === "USER_ROLE"
            ? "accent"
            : "neutral";

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-dim">{t("activityDesc")}</p>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-5 py-3 font-medium">{t("colWhen")}</th>
                <th className="px-3 py-3 font-medium">{t("colActor")}</th>
                <th className="px-3 py-3 font-medium">{t("colAction")}</th>
                <th className="px-3 py-3 font-medium">{t("colTarget")}</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">{t("colIp")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-faint">
                    {t("activityEmpty")}
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line/50 last:border-0">
                  <td className="px-5 py-3 text-xs text-ink-faint whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-dim break-all">{e.actorEmail}</td>
                  <td className="px-3 py-3">
                    <Badge tone={tone(e.action)}>{label(e.action)}</Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-dim break-all">{e.targetLabel ?? "—"}</td>
                  <td className="px-5 py-3 hidden md:table-cell font-mono text-xs text-ink-faint">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Pager page={page} pages={pages} onPage={setPage} countLabel={t("activityCount", { count: total })} />
    </div>
  );
}
