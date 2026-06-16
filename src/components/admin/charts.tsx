"use client";

/**
 * Pure-SVG mini charts (daily bars) — zero dependencies, ~0 resources.
 */
export function BarChart({
  data,
  label,
  total,
  tone = "accent",
}: {
  data: number[];
  label: string;
  total: number;
  tone?: "accent" | "ok" | "ink";
}) {
  const max = Math.max(1, ...data);
  const color =
    tone === "ok" ? "var(--color-ok)" : tone === "ink" ? "var(--color-ink-faint)" : "var(--color-accent)";
  const W = 120;
  const H = 36;
  const n = Math.max(1, data.length);
  const bw = W / n;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-ink-faint">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-ink">{total}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1.5 h-10 w-full" aria-hidden>
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
