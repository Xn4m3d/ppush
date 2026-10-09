/**
 * Diffusion — particle engine for the send and receive screens.
 *
 * A single canvas covers the work area (form + cloud). The cloud IS
 * a view of the encrypted content: each point's position is derived from the
 * ciphertext bytes. On send, particles leave the input field and
 * join the cloud; when the link is created, the cloud writes the address and the
 * key comes from the field (it never went through the server). On
 * reception, the cloud condenses back into readable characters.
 *
 * No data is sent anywhere: this is display only. The
 * bytes given to `setBytes()` are a throwaway ciphertext, produced locally
 * for the visualization, distinct from the one actually sent.
 *
 * Client only (canvas, Range, getComputedStyle).
 */

type Pt = { x: number; y: number };
type Curve = [Pt, Pt, Pt, Pt];

type Particle = {
  x: number; y: number; vx: number; vy: number; a: number;
  seed: number; dying: boolean; delay: number;
  // place in the cloud (normalized polar coordinates)
  ang: number; rad: number;
  // guided path (0 → 1) from `from`
  ride: number; rideSp: number; from: Pt;
  // fixed target (a letter of the link or secret): replaces the place in the cloud
  line: Pt | null;
  key: boolean; byte: number; hot: boolean; r: number;
};

export type SceneMode = "live" | "forming" | "formed";

const SPLIT = 0.3;
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

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
  private parts: (Particle | null)[] = [];
  private dust: { s: number; u: number; sp: number; j: number }[] = [];
  private streams: Curve[] = [];
  private bytes: Uint8Array = new Uint8Array(0);
  private lastN = 0;
  private raf = 0;
  private time = 0;
  private last = 0;
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private ink = "#e4e9f0";
  private acc = "#ff7a59";
  private lineCol = "rgba(228,233,240,0.32)";
  private ptr = { x: -1e4, y: -1e4, on: false };
  private Z = {
    stacked: false, cx0: 0, cx1: 0, top: 0, bot: 0, ccx: 0, ccy: 0, cw: 0, ch: 0,
    src: { x: 0, y: 0 } as Pt, anchor: { x: 0, y: 0, w: 0, h: 0 },
  };

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
        ? { x: Z.ccx + f * Z.cw * 0.8, y: Z.ccy - Z.ch * 0.12 }
        : { x: Z.ccx - Z.cw * 0.18 + Math.abs(f) * Z.cw * 0.1, y: Z.ccy + f * Z.ch * 0.7 };
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
    this.o.canvas.width = Math.round(this.W * dpr);
    this.o.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  }

  private countFor(L: number) {
    return L ? Math.min(this.reduce ? 700 : 1400, 140 + L * 24) : 0;
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
    return { x: Z.ccx + Math.cos(a) * r * (Z.cw / 2.4), y: Z.ccy + Math.sin(a) * r * (Z.ch / 3.1) };
  }

  private path(p: Particle, tg: Pt, e: number): Pt {
    if (this.o.direction === "out" && !p.line) {
      if (e < SPLIT) { const u = e / SPLIT; return { x: p.from.x + (this.Z.src.x - p.from.x) * u, y: p.from.y + (this.Z.src.y - p.from.y) * u }; }
      return bez(this.curve(this.Z.src, tg), (e - SPLIT) / (1 - SPLIT));
    }
    if (p.key) {
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

  /**
   * Send: the cloud writes the address (`idEl`); the key (`keyEl`) comes from the
   * field, described by `keyFrom` (client rect of the typed text).
   */
  seal(idEl: HTMLElement, keyEl: HTMLElement, keyFrom: { x0: number; x1: number; y0: number; y1: number } | null) {
    this.mode = "forming";
    this.age = this.ageTarget = 0;
    const idPts = this.glyphPoints(idEl), keyPts = this.glyphPoints(keyEl);
    const pool = this.parts.filter((p): p is Particle => !!p && !p.dying && p.delay <= 0);
    let j = 0;
    for (const pt of idPts) { const p = pool[j++]; if (!p) break; p.line = pt; p.ride = 1; p.key = false; }
    for (; j < pool.length; j++) pool[j].dying = true;
    this.parts.forEach((p) => { if (p && p.delay > 0) p.dying = true; });
    const Z = this.Z;
    keyPts.forEach((pt, k) => {
      const e: Pt = Z.stacked || !keyFrom
        ? { x: Z.src.x, y: Z.src.y }
        : { x: keyFrom.x0 + Math.random() * (keyFrom.x1 - keyFrom.x0), y: keyFrom.y0 + Math.random() * (keyFrom.y1 - keyFrom.y0) };
      this.parts.push({
        x: e.x, y: e.y, vx: 0, vy: 0, a: 0, seed: Math.random() * 1000, dying: false,
        delay: this.reduce ? 0 : 14 + k * 0.12, ang: 0, rad: 0,
        ride: this.reduce ? 1 : 0, rideSp: 0.017 + Math.random() * 0.008, from: e,
        line: pt, key: true, byte: 255, hot: true, r: 1,
      });
    });
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
    this.parts.forEach((p) => { if (p) p.dying = true; });
    this.lastN = 0;
    this.layout();
  }

  private frame = (now: number) => {
    const dt = Math.min(2.5, (now - this.last) / 16.67);
    this.last = now; this.time += dt / 60;
    const { ctx, Z } = this;
    const still = this.reduce;
    this.age += (this.ageTarget - this.age) * (still ? 1 : Math.min(1, 0.14 * dt));
    if (Math.abs(this.age - this.ageTarget) < 0.0005) this.age = this.ageTarget;
    this.energy *= Math.pow(0.965, dt);
    ctx.clearRect(0, 0, this.W, this.H);

    const t = this.age, fade = Math.pow(1 - t, 1.25), spread = 1 + t * 0.9;
    const live = this.mode === "live", has = this.bytes.length > 0;

    // permanent streams between the field and the cloud, and the dust following them
    // reception on narrow screens: the cloud sits above the text, streams
    // down to the button would cross the title — leave them out
    const showStreams = !(this.o.direction === "in" && this.Z.stacked);
    if (live && fade > 0.01 && this.streams.length && showStreams) {
      const src = this.Z.src;
      if (this.o.direction === "out") {
        const g = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, 46);
        g.addColorStop(0, this.mix(this.ink, 0.05 + this.energy * 0.08)); g.addColorStop(1, this.mix(this.ink, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(src.x, src.y, 46, 0, Math.PI * 2); ctx.fill();
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
          ctx.beginPath(); ctx.arc(q.x, q.y + d.j * d.u, 1.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    if (this.ring && has && live && fade > 0.01) {
      ctx.save(); ctx.globalAlpha = 0.4 * fade; ctx.strokeStyle = this.acc; ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = still ? 0 : -this.time * 12;
      ctx.beginPath(); ctx.ellipse(Z.ccx, Z.ccy, (Z.cw / 2.1) * spread, (Z.ch / 2.2) * spread, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    const k = live ? 0.02 : 0.045, damp = live ? 0.87 : 0.78;
    const flowAmp = (live ? 0.08 : 0.004) * (1 + t * 3);
    const R = Z.stacked ? 56 : 90;
    // the cloud only parts when the pointer is over it (not while typing)
    const near = this.ptr.on && this.ptr.x > Z.cx0 - 20 && this.ptr.x < Z.cx1 + 20 && this.ptr.y > Z.top - 20 && this.ptr.y < Z.bot + 20;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; if (!p) continue;
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
        ctx.globalAlpha = a; ctx.fillStyle = this.acc; ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = live ? (p.hot ? this.acc : this.ink) : p.key ? this.acc : this.ink;
        ctx.beginPath(); ctx.arc(p.x, p.y, live ? (p.hot ? p.r + 0.6 : p.r) : 0.95, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (this.parts.length > 3000) this.parts = this.parts.filter(Boolean);

    if (has && fade > 0.01 && live && this.reads > 0) {
      const n = Math.min(this.reads, 20), gap = 12, x0 = Z.ccx - ((n - 1) * gap) / 2, y = Z.bot - 6;
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = this.acc;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (t > 0.995 && this.destroyedLabel) {
      ctx.fillStyle = this.ink; ctx.globalAlpha = 0.9; ctx.textAlign = "center";
      ctx.font = `500 ${Z.stacked ? 15 : 19}px ${getComputedStyle(this.o.host).fontFamily}`;
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
    w = Math.max(8, Math.min(w, el.clientWidth - pl * 2));
    const cy = r.y + r.h / 2;
    if (uptoCaret) return { x0: r.x + pl + w - 10, x1: r.x + pl + w, y0: cy - 4, y1: cy + 4 };
    return { x0: r.x + pl, x1: r.x + pl + w, y0: cy - 4, y1: cy + 4 };
  }
}
