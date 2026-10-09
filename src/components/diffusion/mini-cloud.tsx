/**
 * Small static cloud for empty states: the encryption echo, in
 * miniature. Deterministic points (same render on server and client), a
 * slow CSS drift, frozen when the user reduces motion.
 */
export function MiniCloud({ className = "", seed = 7 }: { className?: string; seed?: number }) {
  // pure hash (no mutated state): same cloud on server and client render
  const h = (n: number) => {
    let t = Math.imul((seed + n * 0x9e3779b9) ^ ((seed + n) >>> 15), 2246822507);
    t ^= t >>> 13;
    return (t >>> 0) / 4294967296;
  };
  const dots = Array.from({ length: 46 }, (_, i) => {
    const a = h(i * 3) * Math.PI * 2;
    const r = Math.sqrt(-2 * Math.log(h(i * 3 + 1) + 1e-6)) * 0.36;
    return { x: 60 + Math.cos(a) * r * 56, y: 34 + Math.sin(a) * r * 26, r: 0.8 + h(i * 3 + 2) * 1.3, hot: i % 9 === 0, o: 0.3 + h(i * 7 + 5) * 0.6 };
  });
  return (
    <svg viewBox="0 0 120 68" className={`mx-auto h-[68px] w-[120px] motion-safe:animate-[cloud-drift_9s_ease-in-out_infinite] ${className}`} aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(2)} fill={d.hot ? "var(--color-accent)" : "var(--color-ink-dim)"} opacity={d.o.toFixed(2)} />
      ))}
    </svg>
  );
}

/**
 * Sidereal halo around a field: a very soft glow and a few stars
 * twinkling around its edge. Decorative, deterministic positions (same
 * server/client render), no interaction.
 */
export function SiderealHalo() {
  const h = (n: number) => {
    let t = Math.imul(0x9e3779b9 + n * 0x85ebca6b, 2246822507);
    t ^= t >>> 13;
    return (t >>> 0) / 4294967296;
  };
  const stars = Array.from({ length: 18 }, (_, i) => {
    // spread over the four edges, just outside the field
    const side = i % 4, u = h(i * 3);
    const off = 5 + h(i * 3 + 1) * 9;
    const pos =
      side === 0 ? { left: `${u * 100}%`, top: `-${off}px` }
      : side === 1 ? { left: `${u * 100}%`, bottom: `-${off}px` }
      : side === 2 ? { top: `${15 + u * 70}%`, left: `-${off}px` }
      : { top: `${15 + u * 70}%`, right: `-${off}px` };
    return { ...pos, size: 1 + h(i * 3 + 2) * 1.6, delay: h(i * 7) * 6, hot: i % 6 === 0 };
  });
  return (
    <span aria-hidden className="sidereal-halo">
      {stars.map(({ size, delay, hot, ...pos }, i) => (
        <i
          key={i}
          style={{ ...pos, width: size, height: size, animationDelay: `${-delay}s`, background: hot ? "var(--color-accent)" : undefined }}
        />
      ))}
    </span>
  );
}
