"use client";

import { cls } from "../ui";

/**
 * Pure-SVG mini charts (daily bars) — zero dependencies, ~0 resources.
 * Each metric is framed and its value colored to its bar tone so they're
 * easy to tell apart. `hint` = explanatory tooltip (e.g. meaning of "Views").
 */
export function BarChart({
  data,
  label,
  total,
  tone = "accent",
  hint,
}: {
  data: number[];
  label: string;
  total: number;
  tone?: "accent" | "ok" | "ink";
  hint?: string;
}) {
  const max = Math.max(1, ...data);
  const color =
    tone === "ok" ? "var(--color-ok)" : tone === "ink" ? "var(--color-ink-faint)" : "var(--color-accent)";
  const valueColor = tone === "ok" ? "text-ok" : tone === "ink" ? "text-ink-dim" : "text-accent-soft";
  const W = 120;
  const H = 36;
  const n = Math.max(1, data.length);
  const bw = W / n;
  return (
    <div className="rounded-xl border border-line bg-bg-soft/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cls(
            "text-xs text-ink-faint",
            hint && "cursor-help border-b border-dotted border-ink-faint/50"
          )}
          title={hint}
        >
          {label}
        </p>
        <p className={cls("text-2xl font-semibold tabular-nums", valueColor)}>{total}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-10 w-full" aria-hidden>
        {data.map((v, i) => {
          const h = (v / max) * (H - 1);
          return (
            <rect
              key={i}
              x={i * bw + 0.4}
              y={H - h}
              width={Math.max(0.6, bw - 0.8)}
              height={Math.max(0, h)}
              rx={0.5}
              fill={color}
              opacity={v > 0 ? 0.85 : 0.15}
            />
          );
        })}
      </svg>
    </div>
  );
}
