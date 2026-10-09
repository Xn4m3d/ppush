/**
 * ppush logo — the diffusing cat. The left half of the head is
 * sharp, the right half scatters into particles: what the send screen does. The
 * third dot on the chin (the "masked password") leaves with the cloud,
 * in the accent color.
 *
 * The particles are fixed (generated once from the silhouette): same
 * render on server and client. Color = currentColor; accent = theme token.
 * The full cat only remains on the 404 page (src/app/not-found.tsx, standalone).
 */

const HEAD =
  "M18 29 L14.5 12 L27.5 19.5 Q32 18 36.5 19.5 L49.5 12 L46 29 Q50 34.5 50 40 Q50 54 32 54 Q14 54 14 40 Q14 34.5 18 29 Z M22 39.5 a3.2 4.2 0 1 0 6.4 0 a3.2 4.2 0 1 0 -6.4 0 Z M35.6 39.5 a3.2 4.2 0 1 0 6.4 0 a3.2 4.2 0 1 0 -6.4 0 Z M19.5 23 L18 16 L23.5 20 Z M44.5 23 L46 16 L40.5 20 Z M29.6 46.5 L34.4 46.5 L32 49.8 Z";

// [x, y, radius, accent (1/0), opacity] in the 64×64 frame
const DOTS: [number, number, number, number, number][] = [
  [47.8, 8.4, 0.85, 0, 0.71],
  [43.8, 12.2, 0.92, 0, 0.81],
  [46, 13.8, 0.89, 0, 0.77],
  [48, 14.3, 0.85, 0, 0.72],
  [34.3, 14.9, 1.03, 0, 0.97],
  [39.1, 15.9, 0.96, 0, 0.88],
  [49.9, 14.7, 0.84, 0, 0.7],
  [33.1, 16.3, 1.05, 0, 1],
  [36.6, 16.2, 0.99, 0, 0.92],
  [38.9, 16.6, 0.97, 0, 0.88],
  [43.7, 18.4, 0.92, 0, 0.81],
  [47.9, 19.5, 0.85, 0, 0.71],
  [33.7, 18.9, 1.04, 1, 0.98],
  [36, 18.6, 1, 0, 0.94],
  [39.1, 20.1, 0.96, 0, 0.87],
  [41.7, 18.7, 0.92, 0, 0.81],
  [44.9, 19.5, 0.89, 0, 0.77],
  [33.9, 20.5, 1.04, 0, 0.98],
  [36.4, 20.2, 1, 0, 0.93],
  [39.1, 20.5, 0.97, 0, 0.88],
  [42, 21.1, 0.93, 0, 0.82],
  [46, 20.6, 0.89, 0, 0.77],
  [34.3, 23.2, 1.03, 0, 0.97],
  [35.9, 23.3, 1.01, 0, 0.94],
  [38.3, 23.7, 0.97, 0, 0.88],
  [41.5, 22, 0.92, 0, 0.82],
  [46.3, 25.2, 0.88, 0, 0.75],
  [33.3, 25.4, 1.04, 0, 0.99],
  [36.3, 24.7, 1, 0, 0.93],
  [38.4, 24.6, 0.97, 0, 0.88],
  [42.1, 24.5, 0.92, 0, 0.82],
  [46.6, 25.1, 0.89, 0, 0.76],
  [48.8, 23.9, 0.84, 0, 0.7],
  [34.4, 27.3, 1.03, 0, 0.97],
  [35.7, 27.2, 1.01, 0, 0.94],
  [41, 28.7, 0.93, 0, 0.83],
  [44.5, 28.9, 0.89, 0, 0.77],
  [49.3, 26.7, 0.84, 0, 0.7],
  [33.7, 29.3, 1.04, 0, 0.98],
  [45.3, 28.4, 0.88, 0, 0.76],
  [49.1, 28.2, 0.85, 0, 0.72],
  [52.3, 30.2, 0.81, 0, 0.66],
  [34.2, 31.6, 1.03, 0, 0.97],
  [46.2, 31.5, 0.89, 0, 0.77],
  [48.8, 30.8, 0.85, 0, 0.71],
  [53.8, 29.4, 0.81, 0, 0.66],
  [33.4, 34, 1.04, 0, 0.99],
  [36.3, 34.2, 1, 0, 0.92],
  [42.2, 34.4, 0.93, 0, 0.82],
  [46.6, 34.7, 0.89, 0, 0.77],
  [50.6, 32.8, 0.84, 0, 0.69],
  [51.8, 33.2, 0.81, 0, 0.66],
  [33.4, 35.9, 1.04, 0, 0.99],
  [36.1, 35.8, 1.01, 0, 0.94],
  [39.3, 34.8, 0.97, 0, 0.88],
  [42.1, 35.2, 0.93, 0, 0.83],
  [45.5, 37.3, 0.89, 0, 0.77],
  [49.6, 35.9, 0.84, 0, 0.7],
  [33.2, 37.7, 1.05, 0, 0.99],
  [35.9, 37.7, 1.01, 0, 0.94],
  [39.2, 37.3, 0.96, 0, 0.88],
  [42.2, 38, 0.92, 0, 0.81],
  [45.4, 37.9, 0.88, 0, 0.75],
  [50.2, 38.6, 0.85, 1, 0.71],
  [33.7, 39.5, 1.04, 0, 0.98],
  [36.2, 40.2, 1, 0, 0.93],
  [38.5, 39.5, 0.96, 0, 0.88],
  [42.1, 40.4, 0.92, 0, 0.82],
  [46.4, 39.4, 0.88, 0, 0.76],
  [33.2, 42.3, 1.05, 0, 1],
  [36.9, 41.9, 0.99, 0, 0.92],
  [42.1, 41.1, 0.93, 0, 0.83],
];

// "small size" version (header, favicon): fewer, larger particles
const DOTS_SMALL: [number, number, number, number, number][] = [
  [37.1, 15, 2.39, 0, 0.96],
  [39.4, 19.8, 2.33, 0, 0.93],
  [46.5, 22, 2.09, 0, 0.84],
  [36.9, 25.9, 2.4, 0, 0.96],
  [44.7, 31.5, 2.14, 0, 0.86],
  [39.1, 37.1, 2.33, 0, 0.93],
  [44.3, 36.7, 2.13, 0, 0.86],
];

/** `detailed`: every particle, for large sizes (≥ 64 px). */
export function CatMark({ className, detailed = false }: { className?: string; detailed?: boolean }) {
  const dots = detailed ? DOTS : DOTS_SMALL;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="currentColor">
      <defs>
        {/* shared id: every instance declares the same clip path */}
        <clipPath id="ppush-logo-half">
          <rect width={detailed ? 33 : 34} height="50" />
        </clipPath>
      </defs>
      <g clipPath="url(#ppush-logo-half)">
        <path transform="translate(6.08 -1) scale(0.81)" fillRule="evenodd" d={HEAD} />
      </g>
      <circle cx="22" cy="54" r={detailed ? 3.7 : 4.4} />
      <circle cx="32" cy="54" r={detailed ? 3.7 : 4.4} />
      <circle cx="45" cy="55.5" r={detailed ? 2.6 : 3.6} fill="var(--color-accent)" />
      {dots.map(([x, y, r, hot, o], i) => (
        <circle key={i} cx={x} cy={y} r={r} opacity={o} fill={hot ? "var(--color-accent)" : undefined} />
      ))}
    </svg>
  );
}
