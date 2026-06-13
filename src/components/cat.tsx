"use client";

/**
 * ppush mascot — the 404 black cat, used sparingly:
 * - CatMark: minimalist head (header logo + favicon)
 * - GuardianCat: guardian of the reveal page (pupils follow the cursor, closed
 *   once the secret is revealed — it does not look, like the server)
 * - SleepingCat: empty states
 * - PawPrint / PawLoader: micro-references (footer, loaders)
 * Pure CSS/SVG, existing dark purple theme. No text — nothing to translate.
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { cls } from "./ui";

/** Minimalist cat head, monochrome (currentColor), cut-out eyes. */
export function CatMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 29 L14.5 12 L27.5 19.5 Q32 18 36.5 19.5 L49.5 12 L46 29 Q50 34.5 50 40 Q50 54 32 54 Q14 54 14 40 Q14 34.5 18 29 Z
           M22 39.5 a3.2 4.2 0 1 0 6.4 0 a3.2 4.2 0 1 0 -6.4 0 Z
           M35.6 39.5 a3.2 4.2 0 1 0 6.4 0 a3.2 4.2 0 1 0 -6.4 0 Z"
      />
    </svg>
  );
}

/** Paw print (currentColor). */
export function PawPrint({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <ellipse cx="6" cy="8" rx="2.4" ry="3.1" />
      <ellipse cx="12" cy="6.4" rx="2.4" ry="3.1" />
      <ellipse cx="18" cy="8" rx="2.4" ry="3.1" />
      <path d="M12 11.5c3.8 0 6.5 2.6 6.5 5.4 0 2-1.5 3.1-3.1 2.6-1.2-.4-2.2-.6-3.4-.6s-2.2.2-3.4.6c-1.6.5-3.1-.6-3.1-2.6 0-2.8 2.7-5.4 6.5-5.4z" />
    </svg>
  );
}

/** Three paw prints pulsing in sequence — replaces "Loading…". */
export function PawLoader() {
  const t = useTranslations("common");
  return (
    <span className="inline-flex items-center gap-2.5 text-ink-faint" role="status">
      <span className="sr-only">{t("loading")}</span>
      {[0, 1, 2].map((i) => (
        // phase offset: the paws "walk"
        <span key={i} className="animate-paw" style={{ animationDelay: `${i * 0.22}s` }}>
          <PawPrint className="size-4" />
        </span>
      ))}
    </span>
  );
}

/**
 * Guardian cat head: pupils follow the cursor, blinks.
 * `asleep` → eyes closed (secret revealed: it does not look).
 */
export function GuardianCat({
  asleep = false,
  happy = false,
}: {
  asleep?: boolean;
  happy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (asleep || happy) return; // still (eyes closed / happy) → no tracking
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const angle = Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)
      );
      const dx = Math.cos(angle) * 3;
      const dy = Math.sin(angle) * 3;
      el.querySelectorAll<HTMLElement>(".gc-pupil").forEach((p) => {
        p.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    document.addEventListener("mousemove", onMove);

    let timer: ReturnType<typeof setTimeout>;
    const blink = () => {
      const eyes = el.querySelectorAll(".gc-eye");
      eyes.forEach((e) => e.classList.add("gc-blink"));
      setTimeout(() => eyes.forEach((e) => e.classList.remove("gc-blink")), 200);
      timer = setTimeout(blink, 2500 + Math.random() * 4000);
    };
    timer = setTimeout(blink, 1800);

    return () => {
      document.removeEventListener("mousemove", onMove);
      clearTimeout(timer);
    };
  }, [asleep, happy]);

  return (
    <div ref={ref} className={cls("gc-cat mx-auto", happy && "gc-bounce")} aria-hidden>
      <div className="gc-ear l" />
      <div className="gc-ear r" />
      <div className="gc-head">
        <div className={cls("gc-eye l", asleep && "gc-closed", happy && "gc-happy")}>
          <div className="gc-pupil" />
        </div>
        <div className={cls("gc-eye r", asleep && "gc-closed", happy && "gc-happy")}>
          <div className="gc-pupil" />
        </div>
        <div className="gc-nose" />
        <div className="gc-mouth" />
      </div>
      {asleep && (
        <>
          <span className="gc-zzz">z</span>
          <span className="gc-zzz">Z</span>
        </>
      )}
    </div>
  );
}

/** Compact sleeping cat — empty states ("nothing to see here, it sleeps on it"). */
export function SleepingCat() {
  return (
    <div className="sc-cat mx-auto" aria-hidden>
      <span className="sc-zzz">z</span>
      <span className="sc-zzz">Z</span>
      <div className="sc-tail" />
      <div className="sc-body" />
      <div className="sc-head">
        <div className="sc-ear l" />
        <div className="sc-ear r" />
        <div className="sc-eye l" />
        <div className="sc-eye r" />
        <div className="sc-nose" />
      </div>
    </div>
  );
}

