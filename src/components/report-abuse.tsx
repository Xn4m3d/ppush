"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { MorphDialog, requestMorphClose } from "./morph-dialog";
import { Button, Textarea, cls } from "./ui";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports";

/**
 * "Does this link look suspicious?": reporting a received link (phishing,
 * malware…). We can't read the content: the report
 * points at the link, then a person decides whether to take it down.
 */
export function ReportAbuse({ slug }: { slug: string }) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const btn = useRef<HTMLButtonElement>(null);

  async function send() {
    if (!reason) return;
    setState("sending");
    const res = await fetch(`/api/p/${encodeURIComponent(slug)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
    }).catch(() => null);
    if (res?.ok) return setState("sent");
    const data = await res?.json().catch(() => null);
    setError(data?.error ?? t("error"));
    setState("error");
  }

  return (
    <>
      <p className="mt-3 text-sm text-ink-faint">
        {t("prompt")}{" "}
        <button
          ref={btn}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 font-medium text-ink-dim underline underline-offset-2 hover:text-ink cursor-pointer"
        >
          <Flag aria-hidden className="size-3.5" />
          {t("action")}
        </button>
      </p>
      <MorphDialog open={open} onClose={() => setOpen(false)} anchorRef={btn} labelledBy="report-title" className="w-[min(520px,calc(100vw-32px))]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="report-title" className="text-base font-bold">{t("title")}</h2>
          <button type="button" onClick={(e) => requestMorphClose(e.currentTarget)} aria-label={t("close")} className="grid size-8 place-items-center rounded-lg text-ink-dim hover:bg-panel hover:text-ink cursor-pointer">✕</button>
        </div>
        {state === "sent" ? (
          <div className="space-y-3 px-5 py-5">
            <p className="font-semibold text-ink">{t("sentTitle")}</p>
            <p className="text-sm text-ink-dim">{t("sentBody")}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={(e) => requestMorphClose(e.currentTarget)}>{t("done")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-auto px-5 py-4">
            <p className="text-sm text-ink-dim">{t("intro")}</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("reasonLabel")}>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cls(
                    "min-h-9 rounded-lg border px-3 text-sm transition-colors cursor-pointer",
                    reason === r ? "border-ink bg-ink text-bg" : "border-line bg-bg text-ink-dim hover:border-line-soft hover:text-ink"
                  )}
                >
                  {t(`reason${r}`)}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="report-comment" className="text-[13px] font-medium text-ink-dim">{t("commentLabel")}</label>
              <Textarea id="report-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} placeholder={t("commentPlaceholder")} />
            </div>
            {state === "error" && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={(e) => requestMorphClose(e.currentTarget)}>{t("cancel")}</Button>
              <Button type="button" onClick={() => void send()} disabled={!reason} loading={state === "sending"}>
                {t("send")}
              </Button>
            </div>
          </div>
        )}
      </MorphDialog>
    </>
  );
}
