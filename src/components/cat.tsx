"use client";

/**
 * ppush mascot — the black cat of the 404. Outside the 404 (standalone,
 * src/app/not-found.tsx), only its head remains, as logo and favicon:
 * empty states and loaders reuse the particle motif
 * (src/components/diffusion/).
 */


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
