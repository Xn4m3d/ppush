"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { cls } from "./ui";

export function CopyButton({
  value,
  label,
  className,
  big,
}: {
  value: string;
  /** Button label; "" = icon only; absent = localized "Copy". */
  label?: string;
  className?: string;
  big?: boolean;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const text = label ?? t("copy");
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={cls(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all cursor-pointer",
        big
          ? "px-4 py-2.5 text-sm bg-accent text-white hover:bg-accent-soft shadow-[0_4px_20px_-4px_rgba(124,108,255,0.45)]"
          : "px-3 py-1.5 text-xs border border-line text-ink-dim hover:text-ink hover:border-line-soft",
        copied && "!text-ok !border-ok/40",
        className
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? (text === "" ? "" : t("copied")) : text}
    </button>
  );
}
