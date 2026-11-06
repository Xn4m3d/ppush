"use client";

import { useEffect, useRef } from "react";

/**
 * Space, behind the whole site: the site is a window set in front of it.
 *
 * A stream of particles crosses the screen diagonally; it meanders and
 * breathes very slowly. Each particle keeps its own depth and pace
 * (near ones are faster, bigger and brighter), with a small
 * offset of its own: no shared field, the stream never moves
 * as one body. A quarter of the particles escape it and cross the whole
 * sky. Drawn as comets: a head and a pale trail, as long as
 * their speed. Behind, far stars drift the same way and
 * nebula glows follow the stream.
 *
 * Nothing follows the scroll; the pointer barely shifts the depths, like a
 * head moving in front of a window. Page changes never touch it
 * (root layout component). Colours read from the theme tokens
 * (`--fx-ink`, `--fx-accent`, `--fx-cool`), read again on every night/day switch.
 * `prefers-reduced-motion`: a still sky.
 */

const TAU = Math.PI * 2;
// the stream's axis: to the right, rising slightly
const TH = -0.32;
const U = { x: Math.cos(TH), y: Math.sin(TH) };
const NV = { x: -Math.sin(TH), y: Math.cos(TH) };

/** Deterministic pseudo-random: the same sky on every resize. */
function h32(a: number) {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** #rrggbb + alpha → rgba() (canvas gradients do not read color-mix). */
function rgba(hex: string, a: number) {
  if (hex[0] !== "#" || hex.length !== 7) return hex;
  return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
}

type Particle = { s: number; q: number; z: number; v: number; r: number; a: number; col: number; w: number; ph: number };
type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; d: number };

// nebula glows, placed on the stream (s: position along it, q: offset)
const GLOWS = [
  { s: 0.26, q: 0, col: 1, a: 0.075, r: 0.42 },
  { s: -0.3, q: 0.4, col: 2, a: 0.07, r: 0.5 },
  { s: -0.12, q: -3.2, col: 1, a: 0.03, r: 0.38 },
];

export function Space() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    const glow = document.createElement("canvas");
    const gtx = glow.getContext("2d");
    if (!cv || !ctx || !gtx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let W = 0, H = 0, sc = 1, L = 0, WN = 0, t = 0, n = 0, seed = 1, raf = 0;
    let last = performance.now();
    let flow: Particle[] = [], stars: Star[] = [];
    let cols = ["#e4e9f0", "#ff7a59", "#7aa2ff"];
    const ptr = { x: 0, y: 0 }, look = { x: 0, y: 0 };
    const A = { x: 0, y: 0 }, B = { x: 0, y: 0 };

    const rnd = () => h32(seed++ * 7919 + 13);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, rnd()))) * Math.cos(TAU * rnd());
    // the stream: its centre line meanders, its width breathes
    const centre = (s: number) =>
      WN * (0.1 * Math.sin((TAU * s) / (1.7 * L) + 0.6 + t * 0.035) + 0.045 * Math.sin((TAU * s) / (0.8 * L) + 2.1 - t * 0.05));
    const half = (s: number) => WN * (0.11 + 0.035 * Math.sin((TAU * s) / (1.1 * L) + t * 0.04));
    const at = (s: number, q: number, ox: number, oy: number, out: { x: number; y: number }) => {
      const d = centre(s) + q * half(s);
      out.x = W / 2 + U.x * s + NV.x * d + ox;
      out.y = H / 2 + U.y * s + NV.y * d + oy;
    };
    // q in half-widths: the stream's core, or the whole sky for a quarter
    const lane = (p: Particle) => { p.q = rnd() < 0.24 ? (rnd() * 2 - 1) * 4.5 : gauss() * 0.8; };

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      cols = [
        cs.getPropertyValue("--fx-ink").trim() || cols[0],
        cs.getPropertyValue("--fx-accent").trim() || cols[1],
        cs.getPropertyValue("--fx-cool").trim() || cols[2],
      ];
      n = 0; // the glows are redrawn in the new colours
    };

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow.width = Math.ceil(W / 4); glow.height = Math.ceil(H / 4);
      sc = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
      // every point of the screen projects within ±L/2 on the axis: the wrap-around stays off screen
      L = W * Math.abs(U.x) + H * Math.abs(U.y) + 120;
      WN = W * Math.abs(NV.x) + H * Math.abs(NV.y);
      seed = 1;
      flow = Array.from({ length: Math.round(Math.min(1500, Math.max(400, (W * H) / 1800))) }, () => {
        const z = rnd(), k = rnd();
        const p: Particle = {
          s: (rnd() - 0.5) * L, q: 0, z,
          v: 0.45 * (0.35 + 1.1 * z ** 1.5) * (0.85 + 0.3 * rnd()),
          r: 0.45 + 1.15 * z * z, a: 0.2 + 0.62 * z,
          col: k < 0.17 ? 1 : k < 0.29 ? 2 : 0,
          w: 0.05 + rnd() * 0.15, ph: rnd() * TAU,
        };
        lane(p);
        return p;
      });
      stars = Array.from({ length: Math.round((W * H) / 4200) }, () => ({
        x: rnd() * W, y: rnd() * H, r: 0.35 + rnd() * 0.75, a: 0.12 + rnd() * 0.4,
        tw: 0.3 + rnd() * 1.2, ph: rnd() * TAU, d: rnd(),
      }));
      n = 0;
    };

    const draw = (now: number) => {
      const still = reduce.matches;
      const dt = Math.min(2.5, (now - last) / 16.67); last = now;
      if (!still) t += dt / 60;
      const e = still ? 1 : 1 - Math.pow(0.96, dt);
      look.x += (ptr.x - look.x) * e; look.y += (ptr.y - look.y) * e;
      ctx.clearRect(0, 0, W, H);

      // nebula glows: they change slowly, drawn at a quarter resolution now and then
      if (n++ % 20 === 0) {
        gtx.clearRect(0, 0, glow.width, glow.height);
        for (const g of GLOWS) {
          at(g.s * L + Math.sin(t * 0.02 + g.s * 9) * 0.04 * L, g.q, 0, 0, A);
          const R = (g.r * WN * (1 + 0.06 * Math.sin(t * 0.05 + g.s * 5))) / 4;
          const gr = gtx.createRadialGradient(A.x / 4, A.y / 4, 0, A.x / 4, A.y / 4, R);
          gr.addColorStop(0, rgba(cols[g.col], g.a)); gr.addColorStop(1, rgba(cols[g.col], 0));
          gtx.fillStyle = gr; gtx.fillRect(0, 0, glow.width, glow.height);
        }
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(glow, 0, 0, W, H);

      // far stars: same direction, slower than anything
      ctx.fillStyle = cols[0];
      for (const s of stars) {
        if (!still) {
          s.x += U.x * 0.03 * sc * dt; s.y += U.y * 0.03 * sc * dt;
          if (s.x > W + 2) s.x -= W + 4;
          if (s.y < -2) s.y += H + 4;
        }
        ctx.globalAlpha = s.a * (still ? 1 : 0.6 + 0.4 * Math.sin(t * s.tw + s.ph));
        ctx.fillRect(s.x - look.x * (3 + 6 * s.d) - s.r, s.y - look.y * (2 + 4 * s.d) - s.r, s.r * 2, s.r * 2);
      }

      // the stream: comets, a bright head and a pale trail; a halo on the nearest
      ctx.lineCap = "round";
      for (const p of flow) {
        if (!still) {
          p.s += p.v * sc * dt;
          if (p.s > L / 2) { p.s -= L; lane(p); }
        }
        const q = p.q + 0.07 * Math.sin(t * p.w * TAU + p.ph);
        const ox = -look.x * (6 + 28 * p.z), oy = -look.y * (4 + 18 * p.z);
        const al = p.a * (0.35 + 0.65 * Math.exp(-(q * q) / 5.1)), col = cols[p.col], r = p.r * sc;
        at(p.s, q, ox, oy, A);
        if (p.z > 0.35) {
          at(p.s - p.v * sc * 22, q, ox, oy, B);
          ctx.globalAlpha = al * 0.28; ctx.strokeStyle = col; ctx.lineWidth = r * 0.9;
          ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(A.x, A.y); ctx.stroke();
        }
        ctx.fillStyle = col;
        if (p.z > 0.75) {
          ctx.globalAlpha = al * 0.1;
          ctx.beginPath(); ctx.arc(A.x, A.y, r * 3.4, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = al;
        ctx.beginPath(); ctx.arc(A.x, A.y, r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };

    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    const onResize = () => { build(); if (reduce.matches) redraw(); };
    const onPointer = (e: PointerEvent) => { ptr.x = e.clientX / W - 0.5; ptr.y = e.clientY / H - 0.5; };
    // a theme switch rewrites data-theme on <html>: re-read the colors
    const mo = new MutationObserver(() => { readColors(); if (reduce.matches) redraw(); });
    const onMotion = () => { last = performance.now(); redraw(); };

    readColors(); build();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    reduce.addEventListener("change", onMotion);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      reduce.removeEventListener("change", onMotion);
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="space" aria-hidden />;
}
