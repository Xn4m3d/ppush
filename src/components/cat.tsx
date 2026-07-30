"use client";

/**
 * ppush mascot — the 404 black cat, used sparingly:
 * - CatMark: minimalist head (header logo + favicon)
 * - SleepingCat: empty states
 * - PawPrint / PawLoader: micro-references (footer, loaders)
 * Pure CSS/SVG, existing dark purple theme. No text — nothing to translate.
 * Note: none of these follow the cursor — the only pointer-animated cat is the
 * 404 one (src/app/not-found.tsx, self-contained).
 */

import { useTranslations } from "next-intl";

/**
 * Cat head, monochrome (currentColor). Cut-out eyes + nose, outlined ears, and
 * three dots like a masked password (•••) under the chin — a nod to the domain
 * (secret sharing). Header logo + favicon.
 */
export function CatMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="currentColor">
      <g transform="translate(6.08 -1) scale(0.81)">
        <path
          fillRule="evenodd"
          d="M18 29 L14.5 12 L27.5 19.5 Q32 18 36.5 19.5 L49.5 12 L46 29 Q50 34.5 50 40 Q50 54 32 54 Q14 54 14 40 Q14 34.5 18 29 Z
             M22 39.5 a3.2 4.2 0 1 0 6.4 0 a3.2 4.2 0 1 0 -6.4 0 Z
             M35.6 39.5 a3.2 4.2 0 1 0 6.4 0 a3.2 4.2 0 1 0 -6.4 0 Z
             M19.5 23 L18 16 L23.5 20 Z  M44.5 23 L46 16 L40.5 20 Z
             M29.6 46.5 L34.4 46.5 L32 49.8 Z"
        />
      </g>
      <circle cx="22" cy="54" r="3.7" />
      <circle cx="32" cy="54" r="3.7" />
      <circle cx="42" cy="54" r="3.7" />
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

