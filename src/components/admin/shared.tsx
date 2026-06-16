"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Copy, Check } from "lucide-react";
import { cls } from "../ui";

/** Stat tile. */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "accent";
}) {
  return (
    <div>
      <p
        className={cls(
          "text-2xl font-semibold tabular-nums",
          tone === "ok"
            ? "text-ok"
            : tone === "warn"
              ? "text-warn"
              : tone === "accent"
                ? "text-accent-soft"
                : "text-ink"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-ink-faint">{label}</p>
    </div>
  );
}

/** Centered modal, closes on backdrop / Esc. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cls(
          "my-8 w-full rounded-2xl border border-line bg-panel shadow-[0_24px_80px_-20px_rgba(0,0,0,0.7)] animate-fade-up",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-bg-soft hover:text-ink cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Compact pagination. */
export function Pager({
  page,
  pages,
  onPage,
  countLabel,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
  countLabel: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-ink-faint">
      <span>{countLabel}</span>
      {pages > 1 && (
        <div className="flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="rounded-lg border border-line px-3 py-1 disabled:opacity-40 hover:text-ink cursor-pointer"
          >
            ‹
          </button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            className="rounded-lg border border-line px-3 py-1 disabled:opacity-40 hover:text-ink cursor-pointer"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

/** Read-only field with a copy button (reset link, etc.). */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border border-line bg-bg-soft px-3 py-2 font-mono text-xs text-ink-dim"
      />
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-xs text-ink-dim transition-colors hover:text-ink cursor-pointer"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        {label}
      </button>
    </div>
  );
}
