"use client";

import { useEffect, useRef } from "react";

/**
 * Background dust — the most discreet echo of the encryption cloud.
 *
 * About sixty particles drift slowly in a current, behind
 * every page. Purely decorative: `position: fixed`, negative `z-index`,
 * no React state. Colors come from the theme tokens (`--fx-ink`,
 * `--fx-accent`), re-read on every night/day switch. `prefers-reduced-motion`
 * freezes the dust without hiding it.
 */
export function Ambient() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let W = 0, H = 0, raf = 0;
    let ink = "#e4e9f0", acc = "#ff7a59";
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--fx-ink").trim() || ink;
      acc = cs.getPropertyValue("--fx-accent").trim() || acc;
    };
    type P = { x: number; y: number; r: number; a: number; hot: boolean; s: number };
    let ps: P[] = [];

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(80, (W * H) / 22000));
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.6 + Math.random() * 1.1, a: 0.15 + Math.random() * 0.45,
        hot: Math.random() < 0.1, s: Math.random() * 1000,
      }));
    };

    let time = 0, last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67); last = now; time += dt / 60;
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        if (!reduce.matches) {
          p.x += (0.12 + Math.sin(p.y * 0.004 + time * 0.2 + p.s) * 0.16) * dt;
          p.y += Math.cos(p.x * 0.003 - time * 0.15 + p.s) * 0.12 * dt;
          if (p.x > W + 4) p.x = -4;
          if (p.y > H + 4) p.y = -4; else if (p.y < -4) p.y = H + 4;
        }
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.hot ? acc : ink;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce.matches) raf = requestAnimationFrame(draw);
    };

    readColors(); resize();
    raf = requestAnimationFrame(draw);
    const onResize = () => { resize(); if (reduce.matches) raf = requestAnimationFrame(draw); };
    window.addEventListener("resize", onResize);
    // a theme switch rewrites data-theme on <html>: re-read the colors
    const mo = new MutationObserver(() => { readColors(); if (reduce.matches) raf = requestAnimationFrame(draw); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); mo.disconnect(); };
  }, []);

  return <canvas ref={ref} className="dust" aria-hidden />;
}
