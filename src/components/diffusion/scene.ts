/**
 * Diffusion — particle engine for the send and receive screens.
 *
 * A single canvas covers the work area (form + cloud). The cloud IS
 * a view of the encrypted content: each point's position is derived from the
 * ciphertext bytes. On send, particles leave the input field and
 * join the cloud; on a click on "Encrypt", the nebula gathers
 * into a crackling cluster, spreads into a line, folds into letters to
 * write the whole link (address and key), then the link glides into place.
 * On receive, the cloud condenses back into readable characters.
 *
 * No data is sent anywhere: this is display only. The
 * bytes given to `setBytes()` are a throwaway ciphertext, produced locally
 * for the visualization, distinct from the one actually sent.
 *
 * Sizes in rem: radii, gaps and influence areas follow the page's
 * font size (`sc`), which itself follows the screen.
 *
 * Client uniquement (canvas, Range, getComputedStyle).
 */

type Pt = { x: number; y: number };
type Curve = [Pt, Pt, Pt, Pt];

/**
 * Choreography segment: cubic Hermite from (x0, y0) to (x1, y1) over
 * [t0, t1] ms, leaving at velocity (vx0, vy0) px/ms, arriving at rest, plus a
 * lateral bulge (bx, by) whose slope is zero at both ends.
 */
type Seg = { t0: number; t1: number; x0: number; y0: number; vx0: number; vy0: number; x1: number; y1: number; bx: number; by: number };

type Particle = {
  x: number; y: number; vx: number; vy: number; a: number;
  seed: number; dying: boolean; delay: number;
  // place in the cloud (normalized polar coordinates)
  ang: number; rad: number;
  // guided path (0 → 1) from `from`
  ride: number; rideSp: number; from: Pt;
  // fixed target (a letter of the secret, on receive): replaces the place in the cloud
  line: Pt | null;
  key: boolean; byte: number; hot: boolean; r: number;
  // position at the previous frame: the choreography starts at the current velocity
  ox?: number; oy?: number;
  // send choreography
  segs?: Seg[] | null;
  gs0?: number; gs1?: number; nz?: number;
  target?: boolean; flipAt?: number; s2?: Seg; f0?: number; f1?: number;
};

export type SceneMode = "live" | "gather" | "write" | "glide" | "forming" | "formed";

const SPLIT = 0.3;
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Cubic Hermite: leaves p0 at velocity v0 (px/ms), reaches p1 at rest, over T ms. */
const herm = (p0: number, v0: number, p1: number, u: number, T: number) => {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * v0 * T + (3 * u2 - 2 * u3) * p1;
};
/** Lateral bulge with zero slope at both ends: never adds a jolt. */
const bump = (u: number) => 16 * u * u * (1 - u) * (1 - u);
const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function h32(a: number): number {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function bez(c: Curve, u: number): Pt {
  const v = 1 - u;
  return {
    x: v * v * v * c[0].x + 3 * v * v * u * c[1].x + 3 * v * u * u * c[2].x + u * u * u * c[3].x,
    y: v * v * v * c[0].y + 3 * v * v * u * c[1].y + 3 * v * u * u * c[2].y + u * u * u * c[3].y,
  };
}

export type SceneOptions = {
  /** Stream direction: "out" = field to cloud (send); "in" = cloud to button (receive). */
  direction: "out" | "in";
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  cloud: () => HTMLElement | null;
  /** Element the streams leave from (out) or flow into (in). */
  anchor: () => HTMLElement | null;
  /** On narrow (stacked) screens, where streams start: the bottom of this element. */
  stackAnchor?: () => HTMLElement | null;
  /** Stacked (single-column) layout? */
  stacked: () => boolean;
};

export class DiffusionScene {
  private o: SceneOptions;
  private ctx: CanvasRenderingContext2D;
  private reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private W = 0;
  private H = 0;
  /** Page font size / 16: the scale of radii and gaps. */
  private sc = 1;
  private parts: (Particle | null)[] = [];
  private dust: { s: number; u: number; sp: number; j: number }[] = [];
  private streams: Curve[] = [];
  private bytes: Uint8Array = new Uint8Array(0);
  private lastN = 0;
  private raf = 0;
  private time = 0;
  private last = 0;
  private frameMs = 16.67;
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private ink = "#e4e9f0";
  private acc = "#ff7a59";
  private lineCol = "rgba(228,233,240,0.32)";
  private ptr = { x: -1e4, y: -1e4, on: false };
  private Z = {
    stacked: false, cx0: 0, cx1: 0, top: 0, bot: 0, ccx: 0, ccy: 0, cw: 0, ch: 0, rx: 0, ry: 0,
    src: { x: 0, y: 0 } as Pt, anchor: { x: 0, y: 0, w: 0, h: 0 },
  };
  /** Send choreography in progress (null: live cloud or receive). */
  private choreo: { t0: number; wt0?: number; lineY?: number; minX?: number; maxX?: number; lineT0?: number; lineT1?: number } | null = null;
  /** Glitch slices (drawing offset only). */
  private slices: { y: number; h: number; dx: number; t0: number; dur: number }[] = [];

  mode: SceneMode = "live";
  /** Simulated aging, 0 (now) → 1 (expired). */
  age = 0;
  ageTarget = 0;
  /** Number of "views" pips drawn under the cloud (0 = none). */
  reads = 0;
  /** Dotted envelope around the cloud (passphrase required). */
  ring = false;
  /** Stream intensity: back to 1 on each keystroke, decays on its own. */
  energy = 0;
  /** Text shown in the center once the secret has "expired". */
  destroyedLabel = "";

  constructor(o: SceneOptions) {
    this.o = o;
    const ctx = o.canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.readColors();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(o.host);
    this.mo = new MutationObserver(() => this.readColors());
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    o.host.addEventListener("pointermove", this.onMove);
    o.host.addEventListener("pointerleave", this.onLeave);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    // Development only (stripped from the production build): steps the
    // scene frame by frame, to inspect the animation in a tab the
    // browser pauses (background tab, automated tests).
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __ppushStep?: (n: number) => void };
      const prev = w.__ppushStep;
      w.__ppushStep = (n: number) => {
        prev?.(n);
        for (let i = 0; i < n; i++) { cancelAnimationFrame(this.raf); this.frame(this.last + 16.67); }
      };
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.mo.disconnect();
    this.o.host.removeEventListener("pointermove", this.onMove);
    this.o.host.removeEventListener("pointerleave", this.onLeave);
  }

  private onMove = (e: PointerEvent) => {
    const b = this.o.host.getBoundingClientRect();
    this.ptr = { x: e.clientX - b.left, y: e.clientY - b.top, on: true };
  };
  private onLeave = () => { this.ptr = { x: -1e4, y: -1e4, on: false }; };

  private readColors() {
    const cs = getComputedStyle(document.documentElement);
    this.ink = cs.getPropertyValue("--fx-ink").trim() || this.ink;
    this.acc = cs.getPropertyValue("--fx-accent").trim() || this.acc;
    this.lineCol = cs.getPropertyValue("--fx-line").trim() || this.lineCol;
  }

  private rel(el: Element) {
    const b = this.o.host.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }

  /** Recomputes the geometry (call when the layout changes). */
  layout() {
    const cloud = this.o.cloud(), anchor = this.o.anchor();
    if (!cloud) return;
    const c = this.rel(cloud);
    const a = anchor ? this.rel(anchor) : { x: 0, y: 0, w: 0, h: 0 };
    const stacked = this.o.stacked();
    const Z = this.Z;
    Object.assign(Z, { stacked, cx0: c.x, cx1: c.x + c.w, top: c.y, bot: c.y + c.h, anchor: a });
    Z.ccx = (Z.cx0 + Z.cx1) / 2; Z.ccy = (Z.top + Z.bot) / 2; Z.cw = Z.cx1 - Z.cx0; Z.ch = Z.bot - Z.top;
    // wide stage: the cloud stays an ellipse, not a stretched band
    Z.rx = Math.min(Z.cw / 2.4, Z.ch * 1.25); Z.ry = Z.ch / 3.1;
    if (this.o.direction === "out") {
      const sa = stacked ? this.o.stackAnchor?.() : null;
      const s = sa ? this.rel(sa) : a;
      Z.src = stacked ? { x: s.x + s.w / 2, y: s.y + s.h + 6 } : { x: a.x + a.w, y: a.y + a.h / 2 };
    } else {
      // stacked reception: the cloud is above, streams flow down to the top of the button
      Z.src = stacked ? { x: a.x + a.w / 2, y: a.y - 6 } : { x: a.x + a.w + 4, y: a.y + a.h / 2 };
    }
    this.buildStreams();
  }

  private curve(p0: Pt, p3: Pt): Curve {
    if (this.Z.stacked) {
      const dy = p3.y - p0.y;
      return [p0, { x: p0.x, y: p0.y + dy * 0.5 }, { x: p3.x, y: p3.y - dy * 0.45 }, p3];
    }
    const dx = p3.x - p0.x;
    return [p0, { x: p0.x + dx * 0.45, y: p0.y }, { x: p3.x - dx * 0.4, y: p3.y + (p0.y - p3.y) * 0.15 }, p3];
  }

  private buildStreams() {
    const Z = this.Z, N = 7;
    this.streams = [];
    for (let s = 0; s < N; s++) {
      const f = (s + 0.5) / N - 0.5;
      const end = Z.stacked
        ? { x: Z.ccx + f * Z.rx * 1.9, y: Z.ccy - Z.ch * 0.12 }
        : { x: Z.ccx - Z.rx * 0.45 + Math.abs(f) * Z.rx * 0.25, y: Z.ccy + f * Z.ch * 0.7 };
      this.streams.push(this.o.direction === "out" ? this.curve(Z.src, end) : this.curve(end, Z.src));
    }
    if (!this.dust.length) {
      for (let i = 0; i < 70; i++) this.dust.push({ s: i % N, u: Math.random(), sp: 0.0025 + Math.random() * 0.003, j: (Math.random() - 0.5) * 8 });
    }
  }

  private resize() {
    const r = this.o.host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.sc = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    this.o.canvas.width = Math.round(this.W * dpr);
    this.o.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  }

  /** Particle count: follows the ciphertext size, then the cloud's area (same density on large screens, ×1.8 at most). */
  private countFor(L: number) {
    if (!L) return 0;
    const base = Math.min(this.reduce ? 700 : 1400, 140 + L * 24);
    const k = Math.max(1, Math.min(1.8, Math.sqrt((this.Z.rx * this.Z.ry) / (250 * 106))));
    return Math.round(base * k);
  }

  /**
   * Replaces the visualized ciphertext. `emit` = where new particles
   * start (otherwise: bottom of the field / exit point); `spread` = spread
   * the emission over a horizontal span (the typed text).
   */
  setBytes(bytes: Uint8Array, emit?: { x0: number; x1: number; y0: number; y1: number } | null) {
    if (this.mode !== "live") return;
    this.bytes = bytes;
    this.energy = 1;
    const B = bytes, L = B.length, n = this.countFor(L);
    const grow = n - this.lastN; this.lastN = n;
    const Z = this.Z;
    for (let i = 0; i < Math.max(n, this.parts.length); i++) {
      let p = this.parts[i];
      if (i >= n) { if (p) p.dying = true; continue; }
      const b1 = B[i % L], b2 = B[(i * 7 + 3) % L], b3 = B[(i * 31 + 11) % L];
      const s = (b1 << 16) ^ (b2 << 8) ^ b3 ^ Math.imul(i, 2654435761);
      const byte = B[(i * 13 + 5) % L];
      if (!p || p.dying) {
        const k = grow > 0 ? Math.max(0, i - (n - grow)) : 0;
        const e: Pt = Z.stacked || !emit
          ? { x: Z.src.x + (h32(i) - 0.5) * 30, y: Z.src.y }
          : { x: emit.x0 + (i / Math.max(1, n)) * (emit.x1 - emit.x0), y: emit.y0 + h32(i * 7) * (emit.y1 - emit.y0) };
        p = this.parts[i] = {
          x: e.x, y: e.y, vx: 0, vy: 0, a: 0, seed: h32(i * 101) * 1000, dying: false,
          delay: this.reduce ? 0 : k * (Math.min(110, 18 + grow * 0.1) / Math.max(1, grow)) + h32(i * 31) * 8,
          ang: 0, rad: 0, ride: this.reduce ? 1 : 0, rideSp: 0.011 + h32(i * 5) * 0.008, from: e,
          line: null, key: false, byte: 0, hot: false, r: 1,
        };
      }
      p.ang = h32(s) * Math.PI * 2;
      p.rad = Math.min(1.2, Math.sqrt(-2 * Math.log(h32(s + 1) + 1e-6)) * 0.42);
      p.byte = byte; p.hot = byte < 34; p.r = 0.7 + ((byte & 15) / 15) * 1.4;
      p.line = null; p.dying = false;
      if (this.reduce) { const t = this.cloudTarget(p, 1); p.x = t.x; p.y = t.y; p.a = 1; }
    }
  }

  /** Empties the cloud (type change, new secret): everything dissolves. */
  clear() {
    this.parts.forEach((p) => { if (p) p.dying = true; });
    this.lastN = 0;
  }

  /** Cloud derived from a seed while the ciphertext is not known yet (reception). */
  seedCloud(seed: string, length: number) {
    const out = new Uint8Array(Math.max(16, length));
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    for (let i = 0; i < out.length; i++) out[i] = Math.floor(h32(h + i * 7919) * 256);
    this.mode = "live";
    this.lastN = 0;
    this.parts = [];
    this.setBytes(out, null);
    // on reception the cloud is already there: nothing arrives from a field
    for (const p of this.parts) {
      if (!p) continue;
      const t = this.cloudTarget(p, 1);
      p.x = t.x + (h32(p.seed) - 0.5) * 60; p.y = t.y + (h32(p.seed + 1) - 0.5) * 60;
      p.ride = 1; p.delay = 0;
    }
  }

  private cloudTarget(p: Particle, spread: number): Pt {
    if (p.line) return p.line;
    const Z = this.Z;
    const rot = this.reduce ? 0 : this.time * 0.035 * (1.4 - p.rad * 0.6);
    const a = p.ang + rot, r = p.rad * spread;
    return { x: Z.ccx + Math.cos(a) * r * Z.rx, y: Z.ccy + Math.sin(a) * r * Z.ry };
  }

  private path(p: Particle, tg: Pt, e: number): Pt {
    if ((this.o.direction === "out" && !p.line) || p.key) {
      if (e < SPLIT) { const u = e / SPLIT; return { x: p.from.x + (this.Z.src.x - p.from.x) * u, y: p.from.y + (this.Z.src.y - p.from.y) * u }; }
      return bez(this.curve(this.Z.src, tg), (e - SPLIT) / (1 - SPLIT));
    }
    return bez(this.curve(p.from, tg), e);
  }

  /**
   * Sample points taken from the actual characters of a text element
   * (one Range per character, glyph rendered in an offscreen canvas).
   */
  glyphPoints(el: HTMLElement, perChar = 14): Pt[] {
    const out: Pt[] = [];
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return out;
    const txt = node.textContent ?? "";
    const font = getComputedStyle(el).font;
    const off = document.createElement("canvas");
    const oc = off.getContext("2d", { willReadFrequently: true });
    if (!oc) return out;
    const hb = this.o.host.getBoundingClientRect();
    const SC = 3;
    for (let i = 0; i < txt.length; i++) {
      if (/\s/.test(txt[i])) continue;
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect(); if (!b.width) continue;
      off.width = Math.ceil(b.width * SC) + 2; off.height = Math.ceil(b.height * SC) + 2;
      oc.setTransform(SC, 0, 0, SC, 0, 0); oc.font = font; oc.fillStyle = "#fff";
      const m = oc.measureText(txt[i]);
      oc.fillText(txt[i], 0, m.fontBoundingBoxAscent || b.height * 0.8);
      const d = oc.getImageData(0, 0, off.width, off.height).data, pts: Pt[] = [];
      for (let y = 0; y < off.height; y += 2) for (let x = 0; x < off.width; x += 2) {
        if (d[(y * off.width + x) * 4 + 3] > 120) pts.push({ x: b.left - hb.left + x / SC, y: b.top - hb.top + y / SC });
      }
      for (let k = pts.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [pts[k], pts[j]] = [pts[j], pts[k]]; }
      out.push(...pts.slice(0, perChar));
    }
    return out;
  }

  /** Position (within the host) of a client rect. */
  toHost(r: DOMRect | { left: number; top: number; width: number; height: number }) {
    const hb = this.o.host.getBoundingClientRect();
    return { x: r.left - hb.left, y: r.top - hb.top, w: r.width, h: r.height };
  }

  // ---------------------------------------------------------------- send choreography

  /** Position of a choreographed particle at time t: chained segments, each continuous in velocity. */
  private posAt(p: Particle, t: number): Pt {
    const S = p.segs;
    if (!S || !S.length) return { x: p.x, y: p.y };
    let prev: Seg | null = null;
    for (const g of S) {
      if (t < g.t0) return prev ? { x: prev.x1, y: prev.y1 } : { x: g.x0, y: g.y0 };
      if (t <= g.t1) {
        const T = g.t1 - g.t0 || 1, u = (t - g.t0) / T, b = bump(u);
        return { x: herm(g.x0, g.vx0, g.x1, u, T) + g.bx * b, y: herm(g.y0, g.vy0, g.y1, u, T) + g.by * b };
      }
      prev = g;
    }
    return { x: prev!.x1, y: prev!.y1 };
  }

  /** Glitch intensity: rises while gathering, holds on the line, zero once the letters form. */
  private glitchAt(t: number) {
    const C = this.choreo;
    if (!C || this.reduce) return 0;
    if (this.mode === "gather") return smooth(clamp01((t - C.t0) / 500));
    if (this.mode === "write" && C.wt0 !== undefined) return 1 - smooth(clamp01((t - C.wt0 - 650) / 550));
    return 0;
  }

  /**
   * Click on "Encrypt": the nebula gathers into an irregular cluster
   * that simmers (3 to 5 random lumps, never a disc). Each
   * particle leaves at the velocity it already had: no jolt. Only the
   * particles that have reached the cloud take part; those still flying
   * from the field fade out. Resolves once the cluster is formed.
   */
  gather(): Promise<void> {
    if (this.mode !== "live") return Promise.resolve();
    const now = performance.now(), Z = this.Z, sc = this.sc, fm = this.frameMs || 16.67;
    this.mode = "gather"; this.choreo = { t0: now }; this.slices = [];
    this.age = this.ageTarget = 0;
    const lumps = Array.from({ length: 3 + ((Math.random() * 3) | 0) }, () => ({
      x: Z.ccx + gauss() * Z.rx * 0.18, y: Z.ccy + gauss() * Z.ry * 0.22, w: 0.45 + Math.random() * 0.8,
    }));
    let end = now;
    for (const p of this.parts) {
      if (!p || p.dying) continue;
      // not in the cloud yet (flying from the field, or not gone): not part of the nebula
      if (p.delay > 0 || p.ride < 1) { p.dying = true; continue; }
      const L = lumps[(Math.random() * lumps.length) | 0];
      const cx = L.x + gauss() * Z.rx * 0.11 * L.w, cy = L.y + gauss() * Z.ry * 0.15 * L.w;
      const T = this.reduce ? 1 : 650 + Math.random() * 550;
      const dx = cx - p.x, dy = cy - p.y, len = Math.hypot(dx, dy) || 1;
      const off = (Math.random() - 0.5) * Math.min(len, 240 * sc) * 0.8;
      const vx = p.ox != null && !this.reduce ? (p.x - p.ox) / fm : 0, vy = p.oy != null && !this.reduce ? (p.y - p.oy) / fm : 0;
      p.segs = [{ t0: now, t1: now + T, x0: p.x, y0: p.y, vx0: vx, vy0: vy, x1: cx, y1: cy, bx: (-dy / len) * off, by: (dx / len) * off }];
      p.gs0 = now; p.gs1 = now + T; p.nz = Math.random() * 1000; p.line = null;
      end = Math.max(end, now + T);
    }
    return new Promise((res) => setTimeout(res, end - now));
  }

  /**
   * Sending failed: the cluster comes apart and each particle goes back to its place
   * in the live cloud, from wherever it is.
   */
  release() {
    if (!this.choreo) return;
    const now = performance.now();
    for (const p of this.parts) {
      if (!p) continue;
      if (p.segs) { const q = this.posAt(p, now); p.x = q.x; p.y = q.y; p.vx = 0; p.vy = 0; }
      p.segs = null; p.gs0 = p.gs1 = undefined; p.target = false; p.flipAt = undefined; p.s2 = undefined; p.f0 = p.f1 = undefined;
    }
    this.choreo = null; this.slices = []; this.mode = "live";
  }

  /**
   * The link is known: the cluster spreads into a scan line (from the middle to
   * the edges), then the line folds into letters. ONLY the particles of the
   * nebula write the link and none is created: the number of dots per
   * letter adapts to the pool. The left of the cluster writes the left of the link.
   * `idEl` / `keyEl`: invisible copy of the link, in the middle of the cloud.
   */
  write(idEl: HTMLElement, keyEl: HTMLElement): Promise<void> {
    const now = performance.now(), sc = this.sc;
    if (!this.choreo) this.choreo = { t0: now };
    const C = this.choreo;
    const pool = this.parts.filter((p): p is Particle => !!p && !p.dying && !!p.segs);
    const chars = ((idEl.textContent ?? "") + (keyEl.textContent ?? "")).replace(/\s/g, "").length || 1;
    const per = Math.max(2, Math.min(14, Math.floor(pool.length / chars)));
    const targets = [
      ...this.glyphPoints(idEl, per).map((pt) => ({ pt, key: false })),
      ...this.glyphPoints(keyEl, per).map((pt) => ({ pt, key: true })),
    ];
    if (!targets.length || !pool.length) return Promise.resolve();
    targets.sort((a, b) => a.pt.x - b.pt.x);
    const base = new Map(pool.map((p) => [p, this.posAt(p, now)]));
    pool.sort((a, b) => base.get(a)!.x - base.get(b)!.x);
    const m = Math.min(targets.length, pool.length), pick = new Map<Particle, { pt: Pt; key: boolean }>();
    for (let i = 0; i < m; i++) pick.set(pool[Math.floor((i * pool.length) / m)], targets[i]);
    const minX = targets[0].pt.x, maxX = targets[targets.length - 1].pt.x, mid = (minX + maxX) / 2, half = (maxX - minX) / 2 || 1;
    const lineY = targets.reduce((sum, t) => sum + t.pt.y, 0) / targets.length;
    Object.assign(C, { wt0: now, lineY, minX, maxX, lineT0: now + 250, lineT1: now + 1150 });
    this.mode = "write";
    const A = this.reduce ? 1 : 560, H = this.reduce ? 0 : 220, B = this.reduce ? 1 : 700;
    let end = now;
    for (const p of pool) {
      const tg = pick.get(p), s = base.get(p)!;
      const tx = tg ? tg.pt.x : minX + Math.random() * (maxX - minX), ty = tg ? tg.pt.y : lineY;
      const lx = tx + (Math.random() - 0.5) * 6 * sc, ly = lineY + (Math.random() - 0.5) * 2.4 * sc;
      const d = this.reduce ? 0 : (Math.abs(tx - mid) / half) * 170 + Math.random() * 40;
      const t0 = now + d, t1 = t0 + A, t2 = t1 + H, t3 = t2 + B;
      p.segs = [
        { t0, t1, x0: s.x, y0: s.y, vx0: 0, vy0: 0, x1: lx, y1: ly, bx: 0, by: (Math.random() - 0.5) * 30 * sc },
        { t0: t2, t1: t3, x0: lx, y0: ly, vx0: 0, vy0: 0, x1: tx, y1: ty, bx: 0, by: 0 },
      ];
      if (tg) { p.target = true; p.key = tg.key; p.flipAt = t1 + Math.random() * H; p.s2 = p.segs[1]; end = Math.max(end, t3); }
      else { p.target = false; p.f0 = t1 - 120; p.f1 = t2 + 260; } // spare particles: they melt into the line
    }
    return new Promise((res) => setTimeout(res, end - now));
  }

  /** The written link glides by (dx, dy) into place, with a slight left-to-right ripple. */
  glide(dx: number, dy: number, ms: number): Promise<void> {
    const now = performance.now(), C = this.choreo;
    if (!C || C.minX === undefined || C.maxX === undefined) return Promise.resolve();
    const span = C.maxX - C.minX || 1;
    let end = now;
    this.mode = "glide";
    for (const p of this.parts) {
      if (!p || p.dying || !p.target || !p.segs) continue;
      const s = p.segs[p.segs.length - 1], d = this.reduce ? 0 : ((s.x1 - C.minX) / span) * 90, T = this.reduce ? 1 : ms;
      p.segs.push({ t0: now + d, t1: now + d + T, x0: s.x1, y0: s.y1, vx0: 0, vy0: 0, x1: s.x1 + dx, y1: s.y1 + dy, bx: 0, by: 0 });
      end = Math.max(end, now + d + T);
    }
    return new Promise((res) => setTimeout(res, end - now));
  }

  /**
   * Gives the cloud the shape of the REAL ciphertext received (reception): existing
   * points glide to their new place, with no new emission.
   */
  reshape(bytes: Uint8Array) {
    if (!bytes.length) return;
    this.bytes = bytes;
    const B = bytes, L = B.length;
    this.parts.forEach((p, i) => {
      if (!p || p.dying) return;
      const s = (B[i % L] << 16) ^ (B[(i * 7 + 3) % L] << 8) ^ B[(i * 31 + 11) % L] ^ Math.imul(i, 2654435761);
      p.ang = h32(s) * Math.PI * 2;
      p.rad = Math.min(1.2, Math.sqrt(-2 * Math.log(h32(s + 1) + 1e-6)) * 0.42);
    });
  }

  /** Reception: the cloud condenses back onto the characters of `el`. */
  condense(el: HTMLElement) {
    this.mode = "forming";
    const chars = (el.textContent ?? "").replace(/\s/g, "").length || 1;
    const live0 = this.parts.filter((p) => p && !p.dying).length;
    // spread the available points over the characters, at most 22 per letter
    const perChar = Math.max(2, Math.min(22, Math.floor(live0 / chars)));
    const pts = this.glyphPoints(el, perChar);
    const live = this.parts.filter((p): p is Particle => !!p && !p.dying);
    for (let k = live.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [live[k], live[j]] = [live[j], live[k]]; }
    let j = 0;
    for (const pt of pts) {
      const p = live[j++]; if (!p) break;
      p.line = pt; p.from = { x: p.x, y: p.y }; p.ride = this.reduce ? 1 : 0;
      p.rideSp = 0.014 + Math.random() * 0.01; p.delay = this.reduce ? 0 : Math.random() * 22; p.key = false;
    }
    for (; j < live.length; j++) { live[j].dying = true; live[j].vy -= 0.4 + Math.random(); }
  }

  /** End of the shaping: particles fade out, the real text takes over. */
  settle() {
    this.mode = "formed";
    this.parts.forEach((p) => { if (p) p.dying = true; });
  }

  /** Back to the live cloud (new secret). */
  unseal() {
    this.mode = "live";
    this.choreo = null;
    this.slices = [];
    this.parts.forEach((p) => { if (p) { p.dying = true; p.segs = null; } });
    this.lastN = 0;
    this.layout();
  }

  /** Choreography frames: positions come from the segments, never from springs. */
  private drawChoreo(now: number, dt: number) {
    const { ctx } = this, C = this.choreo!, sc = this.sc, still = this.reduce, G = this.glitchAt(now);
    // glitch slice: a thin horizontal band slides sideways and back (drawing offset only)
    if (G > 0.05 && Math.random() < 0.1 * G * dt) {
      const onLine = this.mode === "write" && C.lineY !== undefined;
      const yc = onLine ? C.lineY! : this.Z.ccy, spanY = onLine ? 24 * sc : this.Z.ry * 0.7;
      this.slices.push({
        y: yc + (Math.random() * 2 - 1) * spanY, h: (3 + Math.random() * 12) * sc,
        dx: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 22) * sc * G, t0: now, dur: 90 + Math.random() * 130,
      });
    }
    this.slices = this.slices.filter((s) => now - s.t0 < s.dur);
    // scan line while the cluster spreads
    if (this.mode === "write" && C.lineT0 !== undefined && C.lineT1 !== undefined && C.minX !== undefined && C.maxX !== undefined) {
      const u = clamp01((now - C.lineT0) / (C.lineT1 - C.lineT0));
      if (u > 0 && u < 1) {
        const x0 = C.minX - 30 * sc, w = C.maxX - C.minX + 60 * sc, g = ctx.createLinearGradient(x0, 0, x0 + w, 0), al = Math.sin(Math.PI * u) * 0.28;
        g.addColorStop(0, this.mix(this.acc, 0)); g.addColorStop(0.5, this.mix(this.acc, al)); g.addColorStop(1, this.mix(this.acc, 0));
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x0, C.lineY! - 0.6 * sc, w, 1.2 * sc);
      }
    }
    const boilW = this.mode === "gather" ? 1 : this.mode === "write" && C.wt0 !== undefined ? 1 - smooth(clamp01((now - C.wt0) / 380)) : 0;
    const tick60 = Math.floor(now / 60), tick90 = Math.floor(now / 90);
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; if (!p) continue;
      if (p.f1 && now >= p.f1) { this.parts[i] = null; continue; }
      p.a += ((p.dying ? 0 : 1) - p.a) * (still ? 1 : Math.min(1, (p.dying ? 0.06 : 0.1) * dt));
      if (p.dying && p.a < 0.02) { this.parts[i] = null; continue; }
      let { x, y } = this.posAt(p, now);
      // the cluster simmers slowly, at random (appears on arrival, disappears when the line forms)
      const boil = p.gs1 !== undefined && p.gs0 !== undefined ? smooth(clamp01((now - p.gs0) / (p.gs1 - p.gs0))) * boilW : 0;
      const nz = p.nz ?? 0;
      if (boil > 0 && !still) {
        x += (Math.sin(now * 0.0019 + nz) * 0.6 + Math.sin(now * 0.0047 + nz * 1.7) * 0.4) * 9 * sc * boil;
        y += (Math.sin(now * 0.0023 + nz * 0.8) * 0.6 + Math.sin(now * 0.0041 + nz * 2.3) * 0.4) * 6 * sc * boil;
      }
      p.x = x; p.y = y;
      let ox = 0;
      for (const s of this.slices) if (Math.abs(y - s.y) < s.h / 2) ox += s.dx * Math.sin((Math.PI * (now - s.t0)) / s.dur);
      const q = p.s2 ? smooth(clamp01((now - p.s2.t0) / (p.s2.t1 - p.s2.t0))) : 0, cloudA = 0.35 + (p.byte / 255) * 0.65;
      let a = p.a * (cloudA + (1 - cloudA) * q) * (p.f0 !== undefined && p.f1 !== undefined ? 1 - smooth(clamp01((now - p.f0) / (p.f1 - p.f0))) : 1);
      const seed = (nz * 977) | 0;
      if (G > 0 && h32(seed + tick60) < 0.12 * G) a *= 0.25; // scintillement
      if (a < 0.01) continue;
      const flipped = p.flipAt !== undefined && now >= p.flipAt;
      const r = ((p.hot && !flipped ? p.r + 0.6 : p.r) * (1 - q) + 0.95 * q) * sc, px = x + ox;
      ctx.globalAlpha = a; ctx.fillStyle = flipped ? (p.key ? this.acc : this.ink) : p.hot ? this.acc : this.ink;
      if (G > 0.3 && !flipped && h32(seed + 7) < 0.35) ctx.fillRect(px - r, y - r, r * 2, r * 2); // some turn into square pixels
      else { ctx.beginPath(); ctx.arc(px, y, r, 0, Math.PI * 2); ctx.fill(); }
      if (G > 0 && h32(seed + 13 + tick90) < 0.1 * G) { // colour split
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = this.acc; ctx.fillRect(px + 2.5 * sc - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = this.ink; ctx.fillRect(px - 2 * sc - r, y - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  private frame = (now: number) => {
    const dt = Math.min(2.5, (now - this.last) / 16.67);
    this.last = now; this.time += dt / 60; this.frameMs = dt * 16.67;
    const { ctx, Z, sc } = this;
    const still = this.reduce;
    this.age += (this.ageTarget - this.age) * (still ? 1 : Math.min(1, 0.14 * dt));
    if (Math.abs(this.age - this.ageTarget) < 0.0005) this.age = this.ageTarget;
    this.energy *= Math.pow(0.965, dt);
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.choreo) {
      this.drawChoreo(now, dt);
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    const t = this.age, fade = Math.pow(1 - t, 1.25), spread = 1 + t * 0.9;
    const live = this.mode === "live", has = this.bytes.length > 0;

    // permanent streams between the field and the cloud, and the dust following them
    // reception on narrow screens: the cloud sits above the text, streams
    // down to the button would cross the title — leave them out
    const showStreams = !(this.o.direction === "in" && this.Z.stacked);
    if (live && fade > 0.01 && this.streams.length && showStreams) {
      const src = this.Z.src;
      if (this.o.direction === "out") {
        const g = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, 46 * sc);
        g.addColorStop(0, this.mix(this.ink, 0.05 + this.energy * 0.08)); g.addColorStop(1, this.mix(this.ink, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(src.x, src.y, 46 * sc, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([2, 10]);
      const dir = this.o.direction === "out" ? -1 : 1;
      ctx.lineDashOffset = still ? 0 : dir * this.time * (24 + this.energy * 90);
      for (const c of this.streams) {
        const gr = ctx.createLinearGradient(c[0].x, c[0].y, c[3].x, c[3].y);
        const a0 = 0.32 + this.energy * 0.4;
        if (this.o.direction === "out") {
          gr.addColorStop(0, this.mix(this.ink, a0)); gr.addColorStop(0.7, this.mix(this.ink, a0 * 0.35)); gr.addColorStop(1, this.mix(this.ink, 0));
        } else {
          gr.addColorStop(0, this.mix(this.ink, 0)); gr.addColorStop(0.5, this.mix(this.ink, 0.12)); gr.addColorStop(1, this.mix(this.ink, 0.32));
        }
        ctx.strokeStyle = gr; ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y); ctx.stroke();
      }
      ctx.restore();
      if (this.o.direction === "out") {
        ctx.fillStyle = this.acc;
        for (const d of this.dust) {
          if (!still) d.u += d.sp * (1 + this.energy * 3) * dt;
          if (d.u > 1) { d.u -= 1; d.s = (Math.random() * this.streams.length) | 0; }
          const c = this.streams[d.s]; if (!c) continue;
          const q = bez(c, d.u);
          ctx.globalAlpha = Math.sin(d.u * Math.PI) * (0.35 + this.energy * 0.5) * fade;
          ctx.beginPath(); ctx.arc(q.x, q.y + d.j * d.u, 1.1 * sc, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    if (this.ring && has && live && fade > 0.01) {
      ctx.save(); ctx.globalAlpha = 0.4 * fade; ctx.strokeStyle = this.acc; ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = still ? 0 : -this.time * 12;
      ctx.beginPath(); ctx.ellipse(Z.ccx, Z.ccy, Z.rx * 1.15 * spread, Z.ry * 1.45 * spread, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    const k = live ? 0.02 : 0.045, damp = live ? 0.87 : 0.78;
    const flowAmp = (live ? 0.08 : 0.004) * (1 + t * 3);
    const R = (Z.stacked ? 56 : 90) * sc;
    // the cloud only parts when the pointer is over it (not while typing)
    const near = this.ptr.on && this.ptr.x > Z.cx0 - 20 && this.ptr.x < Z.cx1 + 20 && this.ptr.y > Z.top - 20 && this.ptr.y < Z.bot + 20;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; if (!p) continue;
      p.ox = p.x; p.oy = p.y; // previous position: the choreography starts at the current velocity
      p.a += ((p.dying ? 0 : 1) - p.a) * (still ? 1 : p.dying ? 0.05 : 0.07);
      if (p.dying && p.a < 0.02) { this.parts[i] = null; continue; }
      if (p.delay > 0) { p.delay -= dt; continue; }
      const tg = this.cloudTarget(p, live ? spread : 1);
      let inFlight = false, inField = false;
      if (p.dying && !live && !p.line) {
        // evaporation: the rest of the cloud rises and fades
        p.vy -= 0.02 * dt; p.vx += Math.sin(p.seed + this.time) * 0.02; p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.ride < 1 && !still) {
        p.ride = Math.min(1, p.ride + p.rideSp * dt);
        const e = ease(p.ride), q = this.path(p, tg, e), q2 = this.path(p, tg, Math.min(1, e + 0.01));
        p.vx = (q2.x - q.x) * 3; p.vy = (q2.y - q.y) * 3; p.x = q.x; p.y = q.y;
        inFlight = p.ride < 0.92;
        inField = (this.o.direction === "out" && !p.line) || p.key ? e < SPLIT : false;
      } else if (!still) {
        let ax = (tg.x - p.x) * k, ay = (tg.y - p.y) * k;
        ax += Math.sin(p.y * 0.013 + this.time * 0.7 + p.seed) * flowAmp;
        ay += Math.cos(p.x * 0.011 - this.time * 0.55 + p.seed * 1.3) * flowAmp;
        if (live && near) {
          const dx = p.x - this.ptr.x, dy = p.y - this.ptr.y, d2 = dx * dx + dy * dy;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 1.5; ax += (dx / d) * f; ay += (dy / d) * f; }
        }
        const dm = Math.pow(damp, dt);
        p.vx = (p.vx + ax * dt) * dm; p.vy = (p.vy + ay * dt) * dm;
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else { p.x = tg.x; p.y = tg.y; }

      const a = p.a * (p.line ? 1 : fade) * (inField ? 0.4 : inFlight ? 0.95 : live ? 0.35 + (p.byte / 255) * 0.65 : 1);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      if (inFlight) {
        const sp = Math.hypot(p.vx, p.vy) || 1, tl = Math.min(8, sp * 0.9);
        ctx.globalAlpha = a * 0.45; ctx.strokeStyle = this.acc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / sp) * tl, p.y - (p.vy / sp) * tl); ctx.stroke();
        ctx.globalAlpha = a; ctx.fillStyle = this.acc; ctx.beginPath(); ctx.arc(p.x, p.y, 1.1 * sc, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = live ? (p.hot ? this.acc : this.ink) : p.key ? this.acc : this.ink;
        ctx.beginPath(); ctx.arc(p.x, p.y, (live ? (p.hot ? p.r + 0.6 : p.r) : 0.95) * sc, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (this.parts.length > 4000) this.parts = this.parts.filter(Boolean);

    if (has && fade > 0.01 && live && this.reads > 0) {
      const n = Math.min(this.reads, 20), gap = 12 * sc, x0 = Z.ccx - ((n - 1) * gap) / 2, y = Z.bot - 6 * sc;
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = this.acc;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, 3 * sc, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (t > 0.995 && this.destroyedLabel) {
      ctx.fillStyle = this.ink; ctx.globalAlpha = 0.9; ctx.textAlign = "center";
      ctx.font = `500 ${Math.round((Z.stacked ? 15 : 19) * sc)}px ${getComputedStyle(this.o.host).fontFamily}`;
      ctx.fillText(this.destroyedLabel, Z.ccx, Z.ccy);
      ctx.globalAlpha = 1;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Token color with opacity (tokens are hex or rgba). */
  private mix(col: string, alpha: number) {
    if (col.startsWith("#") && col.length === 7) {
      const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return col;
  }

  /** Horizontal span of a field's text (so particles start from the characters). */
  textSpan(el: HTMLInputElement | HTMLTextAreaElement, masked: boolean, uptoCaret = false) {
    const r = this.rel(el);
    if (el instanceof HTMLTextAreaElement) return { x0: r.x + 14, x1: r.x + r.w - 14, y0: r.y + 14, y1: r.y + r.h - 14 };
    const m = document.createElement("canvas").getContext("2d");
    const cs = getComputedStyle(el);
    const val = uptoCaret && el.selectionStart != null ? el.value.slice(0, el.selectionStart) : el.value;
    const shown = masked ? "•".repeat([...val].length) : val;
    let w = 8;
    if (m) { m.font = cs.font; w = m.measureText(shown).width - el.scrollLeft; }
    const pl = parseFloat(cs.paddingLeft) || 14;
    const pr = parseFloat(cs.paddingRight) || pl;
    w = Math.max(8, Math.min(w, el.clientWidth - pl - pr));
    const cy = r.y + r.h / 2;
    if (uptoCaret) return { x0: r.x + pl + w - 10, x1: r.x + pl + w, y0: cy - 4, y1: cy + 4 };
    return { x0: r.x + pl, x1: r.x + pl + w, y0: cy - 4, y1: cy + 4 };
  }
}
