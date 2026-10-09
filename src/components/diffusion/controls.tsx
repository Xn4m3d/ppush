"use client";

import { useEffect, useRef, useState } from "react";
import { cls } from "../ui";

const PITCH = 52;

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

/**
 * Lifetime — a graduated ruler scrolling under a fixed marker. Drag, click
 * a tick, wheel or arrow keys. Steps beyond `allowedMax` are
 * greyed out (what an account would unlock) and the ruler stops there.
 */
export function DurationDial({
  presets,
  allowedMax,
  index,
  onChange,
  onLocked,
  short,
  labelId,
  valueText,
}: {
  presets: number[];
  /** Last selectable index. */
  allowedMax: number;
  index: number;
  onChange: (i: number) => void;
  /** Called when the user targets a locked step (true) or comes back (false). */
  onLocked: (locked: boolean) => void;
  short: (minutes: number) => string;
  labelId: string;
  valueText: string;
}) {
  const drag = useRef<{ x: number; start: number; off: number; moved: boolean } | null>(null);
  const [snap, setSnap] = useState(true);
  const [off, setOff] = useState<number | null>(null);

  const go = (i: number) => {
    const want = Math.max(0, Math.min(presets.length - 1, i));
    onLocked(want > allowedMax);
    onChange(Math.min(want, allowedMax));
  };
  const wheelRef = useRef<HTMLDivElement>(null);
  useWheel(wheelRef, (e) => {
    e.preventDefault();
    const s = Math.sign(e.deltaY || e.deltaX);
    if (s) go(index + s);
  });

  const shown = off ?? index * PITCH;

  return (
    <div
      ref={wheelRef}
      role="slider"
      tabIndex={0}
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={allowedMax}
      aria-valuenow={index}
      aria-valuetext={valueText}
      className="relative h-12 cursor-grab touch-none select-none overflow-hidden rounded-xl border border-line bg-panel outline-offset-[3px] active:cursor-grabbing [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, start: index, off: index * PITCH, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
        setSnap(false);
        setOff(index * PITCH);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 4) d.moved = true;
        let o = d.start * PITCH - dx;
        const max = (presets.length - 1) * PITCH;
        if (o < 0) o *= 0.3;
        if (o > max) o = max + (o - max) * 0.3;
        d.off = o;
        setOff(o);
        const i = Math.round(o / PITCH);
        if (i >= 0 && i <= allowedMax && i !== index) onChange(i);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        let i = Math.round(d.off / PITCH);
        if (!d.moved) {
          const t = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
          if (t) i = Number(t.dataset.i);
        }
        setSnap(true);
        setOff(null);
        go(i);
      }}
      onPointerCancel={() => { drag.current = null; setSnap(true); setOff(null); }}
      onKeyDown={(e) => {
        const m = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
        if (m) { e.preventDefault(); go(index + m); }
        else if (e.key === "Home") { e.preventDefault(); go(0); }
        else if (e.key === "End") { e.preventDefault(); go(allowedMax); }
      }}
    >
      <div
        className={cls("absolute inset-y-0 left-1/2 flex will-change-transform", snap && "transition-transform duration-[350ms] [transition-timing-function:cubic-bezier(.2,.9,.25,1.15)]")}
        style={{ transform: `translateX(${-shown}px)` }}
      >
        {presets.map((m, i) => (
          <div
            key={m}
            data-i={i}
            className={cls(
              "relative -ml-[26px] mr-[26px] flex w-[52px] flex-none flex-col items-center justify-end pb-1.5 font-mono text-[11.5px] transition-colors",
              i === index ? "text-ink" : i > allowedMax ? "text-line-soft" : "text-ink-faint"
            )}
          >
            <span className={cls("absolute top-2 h-3 w-px", i > allowedMax ? "bg-line" : "bg-line-soft")} />
            {i < presets.length - 1 && <span className="absolute left-[52px] top-2 h-1.5 w-px bg-line" />}
            {short(m)}
          </div>
        ))}
      </div>
      <span aria-hidden className="absolute left-1/2 top-1 h-[22px] w-0.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_var(--accent-glow)]" />
    </div>
  );
}

/**
 * Views — pips to fill (click or drag). Beyond `allowed`,
 * pips are dotted (account). If `allowed` exceeds 10, we
 * keep 10 pips and two buttons let you go higher.
 */
export function ReadsPips({
  value,
  allowed,
  onChange,
  onLocked,
  labelId,
  valueText,
  moreLabel,
  lessLabel,
}: {
  value: number;
  allowed: number;
  onChange: (n: number) => void;
  onLocked: (locked: boolean) => void;
  labelId: string;
  valueText: string;
  moreLabel: string;
  lessLabel: string;
}) {
  const N = 10;
  const dragging = useRef(false);
  const set = (n: number) => {
    const want = Math.max(1, Math.min(Math.max(allowed, N), n));
    onLocked(want > allowed);
    onChange(Math.min(want, allowed));
  };
  const wheelRef = useRef<HTMLDivElement>(null);
  useWheel(wheelRef, (e) => {
    e.preventDefault();
    const s = -Math.sign(e.deltaY);
    if (s) set(value + s);
  });
  const pipAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-n]");
    return el ? Number(el.dataset.n) : null;
  };
  return (
    <div className="flex items-center gap-1.5">
      <div
        ref={wheelRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={1}
        aria-valuemax={allowed}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="grid h-12 flex-1 cursor-pointer touch-none select-none grid-cols-10 gap-1 rounded-xl outline-offset-[3px]"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); const n = pipAt(e.clientX, e.clientY); if (n) set(n); }}
        onPointerMove={(e) => { if (!dragging.current) return; const n = pipAt(e.clientX, e.clientY); if (n && n !== value) set(n); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={(e) => {
          const m = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
          if (m) { e.preventDefault(); set(value + m); }
          else if (e.key === "Home") { e.preventDefault(); set(1); }
          else if (e.key === "End") { e.preventDefault(); set(allowed); }
        }}
      >
        {Array.from({ length: N }, (_, k) => {
          const n = k + 1, on = n <= Math.min(value, N), locked = n > allowed;
          return (
            <span
              key={n}
              data-n={n}
              className={cls(
                "rounded-lg border transition-[background-color,border-color,transform] duration-200",
                locked ? "border-dashed border-line bg-transparent opacity-60" : "hover:-translate-y-0.5",
                on && !locked ? (n === Math.min(value, N) ? "border-accent bg-accent" : "border-ink bg-ink") : !locked && "border-line bg-panel"
              )}
            />
          );
        })}
      </div>
      {allowed > N && (
        <div className="flex flex-col gap-1">
          <button type="button" aria-label={moreLabel} onClick={() => set(value + 1)} className="grid h-[22px] w-7 place-items-center rounded-md border border-line text-xs text-ink-dim hover:text-ink cursor-pointer">+</button>
          <button type="button" aria-label={lessLabel} onClick={() => set(value - 1)} className="grid h-[22px] w-7 place-items-center rounded-md border border-line text-xs text-ink-dim hover:text-ink cursor-pointer">−</button>
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
              "absolute top-4 whitespace-nowrap font-mono text-[11px] text-ink-faint",
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
