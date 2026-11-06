"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { cls } from "../ui";

/**
 * Wheel as a native non-passive listener: React attaches `onWheel` as passive,
 * which would let the page scroll while the control is being adjusted.
 */
export function useWheel<T extends HTMLElement>(ref: React.RefObject<T | null>, handler: (e: WheelEvent) => void) {
  const h = useRef(handler);
  useEffect(() => { h.current = handler; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = (e: WheelEvent) => h.current(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, [ref]);
}

/** Index of the `[data-i]` element under the pointer (click or drag along a row). */
function pickAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-i]");
  return el ? Number(el.dataset.i) : null;
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

/**
 * Duration — a ruler graduated by unit (minutes, hours, days): each notch only
 * carries a number, the unit is written once above its group. The
 * notches beyond `allowedMax` (what an account would unlock) are grouped
 * at the end, under a padlock; aiming at them sets the duration to the cap (`onLocked`).
 * Click or drag, wheel, arrows / Home / End.
 */
export function DurationRuler({
  presets,
  allowedMax,
  index,
  onChange,
  onLocked,
  labelId,
  valueText,
  units,
  title,
}: {
  presets: number[];
  /** Last selectable index. */
  allowedMax: number;
  index: number;
  onChange: (i: number) => void;
  /** Called when the user targets a locked step (true) or comes back (false). */
  onLocked: (locked: boolean) => void;
  labelId: string;
  valueText: string;
  /** Group captions. */
  units: { min: string; hour: string; day: string; account: string };
  /** Full label of a notch (tooltip). */
  title: (minutes: number, locked: boolean) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const go = (i: number) => {
    const want = Math.max(0, Math.min(presets.length - 1, i));
    onLocked(want > allowedMax);
    onChange(Math.min(want, allowedMax));
  };
  useWheel(ref, (e) => {
    e.preventDefault();
    const s = Math.sign(e.deltaY || e.deltaX);
    if (s) go(index + s);
  });

  // consecutive groups: minutes, hours, allowed days, then what an account unlocks
  const groups: { label: string; lock: boolean; items: { m: number; i: number }[] }[] = [];
  presets.forEach((m, i) => {
    const lock = i > allowedMax;
    const label = lock ? units.account : m < 60 ? units.min : m < 1440 ? units.hour : units.day;
    const g = groups[groups.length - 1];
    if (g && g.label === label && g.lock === lock) g.items.push({ m, i });
    else groups.push({ label, lock, items: [{ m, i }] });
  });
  const num = (m: number) => (m < 60 ? m : m < 1440 ? Math.round(m / 60) : Math.round(m / 1440));

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={allowedMax}
      aria-valuenow={index}
      aria-valuetext={valueText}
      className="flex cursor-pointer touch-none select-none gap-[0.9rem] rounded-md outline-offset-4"
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); const i = pickAt(e.clientX, e.clientY); if (i !== null) go(i); }}
      onPointerMove={(e) => { if (!dragging.current) return; const i = pickAt(e.clientX, e.clientY); if (i !== null && Math.min(i, allowedMax) !== index) go(i); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      onKeyDown={(e) => {
        const m = STEP[e.key];
        if (m) { e.preventDefault(); go(index + m); }
        else if (e.key === "Home") { e.preventDefault(); go(0); }
        else if (e.key === "End") { e.preventDefault(); go(allowedMax); }
      }}
    >
      {groups.map((g) => (
        <div key={g.label + g.items[0].i} className="flex min-w-0 flex-col gap-1" style={{ flex: `${g.items.length} 1 0` }}>
          <span className={cls("flex min-h-4 items-center gap-1 overflow-hidden whitespace-nowrap font-mono text-[0.64rem] uppercase tracking-[0.08em]", g.lock ? "text-ink-faint/75" : "text-ink-faint")}>
            {g.lock && <Lock aria-hidden className="size-[0.7rem] flex-none" />}
            {g.label}
          </span>
          <span className={cls("flex border-t border-line-soft", g.lock && "border-dashed")}>
            {g.items.map(({ m, i }) => {
              const on = i === index;
              return (
                <span
                  key={m}
                  data-i={i}
                  title={title(m, g.lock)}
                  className={cls(
                    "relative flex h-10 min-w-0 flex-1 items-end justify-center pb-0.5 font-mono text-[0.8rem] tabular-nums transition-colors",
                    on ? "font-semibold text-ink" : g.lock ? "text-ink-faint/55" : "text-ink-faint hover:text-ink"
                  )}
                >
                  <span
                    aria-hidden
                    className={cls(
                      "absolute top-0 left-1/2 -translate-x-1/2 transition-[height,background-color]",
                      on ? "h-4 w-0.5 bg-accent shadow-[0_0_8px_var(--accent-glow)]" : g.lock ? "h-2 w-px bg-line" : "h-2 w-px bg-line-soft"
                    )}
                  />
                  {num(m)}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Reads — ten dots, like the ones that appear under the cloud (click or
 * drag). Beyond `allowed`, the dots are dashed, grouped at the
 * end under a padlock (account). If `allowed` exceeds 10, we keep 10 dots
 * and two buttons go higher.
 */
export function ReadsDots({
  value,
  allowed,
  onChange,
  onLocked,
  labelId,
  valueText,
  moreLabel,
  lessLabel,
  accountLabel,
  title,
}: {
  value: number;
  allowed: number;
  onChange: (n: number) => void;
  onLocked: (locked: boolean) => void;
  labelId: string;
  valueText: string;
  moreLabel: string;
  lessLabel: string;
  accountLabel: string;
  /** Label of a dot (tooltip). */
  title: (n: number, locked: boolean) => string;
}) {
  const N = 10;
  const dragging = useRef(false);
  const set = (n: number) => {
    const want = Math.max(1, Math.min(Math.max(allowed, N), n));
    onLocked(want > allowed);
    onChange(Math.min(want, allowed));
  };
  const ref = useRef<HTMLDivElement>(null);
  useWheel(ref, (e) => {
    e.preventDefault();
    const s = -Math.sign(e.deltaY);
    if (s) set(value + s);
  });
  const free = Math.min(allowed, N);
  const groups = [{ lock: false, from: 1, to: free }, ...(free < N ? [{ lock: true, from: free + 1, to: N }] : [])];
  return (
    <div className="flex items-end gap-2">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={1}
        aria-valuemax={allowed}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="flex flex-1 cursor-pointer touch-none select-none gap-[0.9rem] rounded-md outline-offset-4"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); const n = pickAt(e.clientX, e.clientY); if (n) set(n); }}
        onPointerMove={(e) => { if (!dragging.current) return; const n = pickAt(e.clientX, e.clientY); if (n && n !== value) set(n); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={(e) => {
          const m = STEP[e.key];
          if (m) { e.preventDefault(); set(value + m); }
          else if (e.key === "Home") { e.preventDefault(); set(1); }
          else if (e.key === "End") { e.preventDefault(); set(allowed); }
        }}
      >
        {groups.map((g) => (
          <div key={g.from} className="flex min-w-0 flex-col gap-1" style={{ flex: `${g.to - g.from + 1} 1 0` }}>
            <span className="flex min-h-4 items-center gap-1 overflow-hidden whitespace-nowrap font-mono text-[0.64rem] uppercase tracking-[0.08em] text-ink-faint/75">
              {g.lock && <><Lock aria-hidden className="size-[0.7rem] flex-none" />{accountLabel}</>}
            </span>
            <span className="flex">
              {Array.from({ length: g.to - g.from + 1 }, (_, k) => {
                const n = g.from + k, cur = n === Math.min(value, N), on = !g.lock && n <= Math.min(value, N);
                return (
                  <span key={n} data-i={n} title={title(n, g.lock)} className="group grid h-10 min-w-0 max-w-[2.6rem] flex-1 place-items-center">
                    <span
                      aria-hidden
                      className={cls(
                        "size-[0.95rem] rounded-full border-[1.5px] transition-[background-color,border-color,transform,box-shadow] duration-200",
                        g.lock
                          ? "border-dashed border-line-soft opacity-70"
                          : cur
                            ? "border-accent bg-accent shadow-[0_0_10px_var(--accent-glow)]"
                            : on
                              ? "border-ink bg-ink group-hover:scale-110"
                              : "border-line-soft group-hover:scale-110 group-hover:border-ink-faint"
                      )}
                    />
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      {allowed > N && (
        <div className="flex flex-col gap-1 pb-1">
          <button type="button" aria-label={moreLabel} onClick={() => set(value + 1)} className="grid h-6 w-7 place-items-center rounded-md text-xs text-ink-dim hover:bg-panel-soft hover:text-ink cursor-pointer">+</button>
          <button type="button" aria-label={lessLabel} onClick={() => set(value - 1)} className="grid h-6 w-7 place-items-center rounded-md text-xs text-ink-dim hover:bg-panel-soft hover:text-ink cursor-pointer">−</button>
        </div>
      )}
    </div>
  );
}

/**
 * Aging timeline: a preview, not a setting. Drag the
 * marker (or use the wheel over the cloud); once released, time returns to the present.
 */
export function AgeTimeline({
  value,
  onChange,
  ticks,
  bubble,
  label,
}: {
  value: number;
  onChange: (t: number, hold: boolean) => void;
  ticks: { at: number; label: string }[];
  /** Spoken position (screen readers). */
  bubble: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const fromX = (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? (x - r.left) / r.width : 0;
  };
  const pct = `${(value * 100).toFixed(2)}%`;

  return (
    <div
      ref={ref}
      className={cls("relative h-[46px] touch-none select-none", active && "is-active")}
      onPointerDown={(e) => { dragging.current = true; setActive(true); e.currentTarget.setPointerCapture(e.pointerId); onChange(fromX(e.clientX), true); }}
      onPointerMove={(e) => { if (dragging.current) onChange(fromX(e.clientX), true); }}
      onPointerUp={() => { dragging.current = false; onChange(value, false); timer.current = setTimeout(() => setActive(false), 2000); }}
      onPointerCancel={() => { dragging.current = false; onChange(value, false); }}
    >
      <div className="absolute inset-x-0 top-3.5 h-px bg-line" />
      <div className="absolute left-0 top-[13px] h-[3px] rounded-full bg-accent" style={{ width: pct }} />
      {ticks.map((tk, i) => (
        <div key={i} className="absolute top-[9px] h-[11px] w-px bg-line-soft" style={{ left: `${tk.at * 100}%` }}>
          <span
            className={cls(
              "absolute top-4 whitespace-nowrap font-mono text-[0.6875rem] text-ink-faint",
              i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            )}
          >
            {tk.label}
          </span>
        </div>
      ))}
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={bubble}
        className="absolute top-1 -ml-[11px] size-[22px] cursor-grab rounded-full bg-ink shadow-[0_0_0_5px_var(--color-bg)] active:cursor-grabbing"
        style={{ left: pct }}
        onKeyDown={(e) => {
          const m = ({ ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.25, PageDown: -0.25 } as Record<string, number>)[e.key];
          if (e.key === "Home") { e.preventDefault(); onChange(0, false); }
          else if (e.key === "End") { e.preventDefault(); onChange(1, false); }
          else if (m) { e.preventDefault(); onChange(Math.max(0, Math.min(1, value + m)), false); }
        }}
      />
    </div>
  );
}
