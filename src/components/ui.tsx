"use client";

import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  const variants = {
    primary:
      "bg-accent text-white hover:bg-accent-soft active:scale-[0.98] shadow-[0_4px_20px_-4px_var(--accent-glow)]",
    ghost:
      "bg-transparent border border-line text-ink-dim hover:text-ink hover:border-line-soft hover:bg-panel",
    subtle: "bg-panel-soft text-ink hover:bg-line/60 border border-line",
    danger:
      "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
  };
  return (
    <button
      className={cls(base, variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cls(
        "w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-base sm:text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cls(
        "w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-base sm:text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y",
        className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink-dim">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cls(
        "rounded-2xl border border-line bg-panel/80 backdrop-blur-sm shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-panel-soft cursor-pointer"
    >
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-faint mt-0.5">{hint}</span>}
      </span>
      <span
        className={cls(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-line-soft"
        )}
      >
        <span
          className={cls(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warn" | "danger" | "neutral" | "accent";
  children: ReactNode;
}) {
  const tones = {
    ok: "bg-ok/10 text-ok border-ok/25",
    warn: "bg-warn/10 text-warn border-warn/25",
    danger: "bg-danger/10 text-danger border-danger/25",
    accent: "bg-accent/10 text-accent-soft border-accent/25",
    neutral: "bg-panel-soft text-ink-dim border-line",
  };
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger animate-fade-up">
      {children}
    </p>
  );
}
