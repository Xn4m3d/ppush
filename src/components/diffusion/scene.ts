/**
 * Diffusion — the cloud of the send and receive screens.
 *
 * The cloud IS a view of the encrypted content: each point's place is
 * derived from the ciphertext bytes. It has no particles of its own: it
 * BORROWS them from the field that lives behind the whole site (`field.ts`) — as soon as one types,
 * background particles are attracted and spiral into it, the more
 * numerous the more bits the password has (`countBits`); when fewer
 * are needed, they leave gently; when the page is left, the cloud
 * bursts (`destroy`) and they resume their life in the background.
 *
 * Alive: differential vortex (the core faster, sped up by each
 * keystroke), a ripple per keystroke, a flash on arrival, random pulses that
 * light the particles up, energy filaments and arcs, a glow at its heart.
 *
 * On a click on "Encrypt", the nebula gathers into a crackling cluster,
 * spreads into a line, folds into letters to write the whole link
 * (address and key), then the link glides into place; its particles then
 * go back upstream in the current. On receive, the cloud condenses back into
 * readable characters and the spare particles go back to the background.
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

import { field, h32, mix, type Dot, type FieldClient, type Particle, type Pt, type Seg } from "./field";

type Curve = [Pt, Pt, Pt, Pt];
type Pulse = { x: number; y: number; R: number; t0: number; dur: number; col: number; k: number; e: number; pts: number[]; arcs: number; seed: number; dir?: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; col: number };

export type SceneMode = "live" | "gather" | "write" | "glide" | "forming" | "formed";

const TAU = Math.PI * 2;
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
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

function bez(c: Curve, u: number): Pt {
  const v = 1 - u;
  return {
    x: v * v * v * c[0].x + 3 * v * v * u * c[1].x + 3 * v * u * u * c[2].x + u * u * u * c[3].x,
    y: v * v * v * c[0].y + 3 * v * v * u * c[1].y + 3 * v * u * u * c[2].y + u * u * u * c[3].y,
  };
}

export type SceneOptions = {
  /** "out": send (reads under the cloud); "in": receive. */
  direction: "out" | "in";
  /** Reference frame of the cloud's coordinates (the work area). */
  host: HTMLElement;
  cloud: () => HTMLElement | null;
  /** Stacked (single-column) layout? */
  stacked: () => boolean;
};

export class DiffusionScene implements FieldClient {
  private o: SceneOptions;
  private reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  /** Page font size / 16: the scale of radii and gaps. */
  private sc = 1;
  private parts: (Particle | null)[] = [];
  private bytes: Uint8Array = new Uint8Array(0);
  /** Particles still to attract from the field (recruited in small waves, on every frame). */
  private queue = 0;
  private time = 0;
  private frameMs = 16.67;
  private hx = 0;
  private hy = 0;
  private ro: ResizeObserver;
  private ptr = { x: -1e4, y: -1e4, on: false };
  private Z = { stacked: false, cx0: 0, cx1: 0, top: 0, bot: 0, ccx: 0, ccy: 0, cw: 0, ch: 0, rx: 0, ry: 0 };
  /** Send choreography in progress (null: live cloud or receive). */
  private choreo: { t0: number; wt0?: number; lineY?: number; minX?: number; maxX?: number; lineT0?: number; lineT1?: number } | null = null;
  /** Glitch slices (drawing offset only). */
  private slices: { y: number; h: number; dx: number; t0: number; dur: number }[] = [];
  /** Vortex phase (sped up by energy), keystroke ripples, light pulses. */
  private phase = 0;
  private ripples: { t0: number; amp: number }[] = [];
  private pulses: Pulse[] = [];
  /** The written link keeps some energy: the element of its text, its sparks, its next sweep of light. */
  private charged: HTMLElement | null = null;
  private sparks: Spark[] = [];
  private sweep: { t0: number; dur: number } | null = null;
  private nextSweep = 0;
  private beat = 0;
  /** How full the cloud is (0 → 1), for the glow at its heart. */
  private fill = 0;

  mode: SceneMode = "live";
  /** Simulated aging, 0 (now) → 1 (expired). */
  age = 0;
  ageTarget = 0;
  /** Number of "views" pips drawn under the cloud (0 = none). */
  reads = 0;
  /** Dotted envelope around the cloud (passphrase required). */
  ring = false;
  /** Typing energy: back to 1 on every keystroke, dies down on its own. */
  energy = 0;
  /** Text shown in the center once the secret has "expired". */
  destroyedLabel = "";
  /** The generator is typing its password: the cloud gives no particles back between two keystrokes. */
  hold = false;

  constructor(o: SceneOptions) {
    this.o = o;
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(o.host);
    o.host.addEventListener("pointermove", this.onMove);
    o.host.addEventListener("pointerleave", this.onLeave);
    this.layout();
    field.attach(this);
  }

  private get reduce() { return this.reduceMq.matches; }

  /** The page is left: the cloud bursts, its particles resume their life in the field. */
  destroy() {
    this.burst();
    field.detach(this);
    this.ro.disconnect();
    this.o.host.removeEventListener("pointermove", this.onMove);
    this.o.host.removeEventListener("pointerleave", this.onLeave);
  }

  private onMove = (e: PointerEvent) => {
    const b = this.o.host.getBoundingClientRect();
    this.ptr = { x: e.clientX - b.left, y: e.clientY - b.top, on: true };
  };
  private onLeave = () => { this.ptr = { x: -1e4, y: -1e4, on: false }; };

  private rel(el: Element) {
    const b = this.o.host.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }

  /** Recomputes the geometry (call when the layout changes). */
  layout() {
    const cloud = this.o.cloud();
    if (!cloud || !cloud.getClientRects().length) return;
    const c = this.rel(cloud), Z = this.Z;
    Object.assign(Z, { stacked: this.o.stacked(), cx0: c.x, cx1: c.x + c.w, top: c.y, bot: c.y + c.h });
    Z.ccx = (Z.cx0 + Z.cx1) / 2; Z.ccy = (Z.top + Z.bot) / 2; Z.cw = c.w; Z.ch = c.h;
    // wide stage: the cloud stays an ellipse, not a stretched band
    Z.rx = Math.min(Z.cw / 2.4, Z.ch * 1.25); Z.ry = Z.ch / 3.1;
    this.sc = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  }

  private curve(p0: Pt, p3: Pt): Curve {
    if (this.Z.stacked) {
      const dy = p3.y - p0.y;
      return [p0, { x: p0.x, y: p0.y + dy * 0.5 }, { x: p3.x, y: p3.y - dy * 0.45 }, p3];
    }
    const dx = p3.x - p0.x;
    return [p0, { x: p0.x + dx * 0.45, y: p0.y }, { x: p3.x - dx * 0.4, y: p3.y + (p0.y - p3.y) * 0.15 }, p3];
  }

  private areaK() { return Math.max(1, Math.min(1.8, Math.sqrt((this.Z.rx * this.Z.ry) / (250 * 106)))); }
  /** About half of the field at most, and no more than the stage holds. */
  private cap() { return Math.round(Math.min(field.size() * 0.55, (this.reduce ? 700 : 1100) * this.areaK())); }
  /** Number of particles for an L-byte ciphertext (text, URL, file). */
  countFor(L: number) { return L ? Math.min(this.cap(), Math.round((140 + L * 24) * this.areaK())) : 0; }
  /** The more bits the password has, the denser the cloud: 50 bits ≈ 60 % of the cap, 80 bits ≈ 77 %. */
  countBits(bits: number) { return bits > 0 ? Math.max(12, Math.round(this.cap() * (1 - Math.exp(-bits / 55)))) : 0; }

  private members() { return this.parts.filter((p): p is Particle => !!p && !p.dying); }

  private slot(p: Particle, i: number) {
    const B = this.bytes, L = B.length;
    if (!L) return;
    const s = (B[i % L] << 16) ^ (B[(i * 7 + 3) % L] << 8) ^ B[(i * 31 + 11) % L] ^ Math.imul(i, 2654435761), byte = B[(i * 13 + 5) % L];
    p.ang = h32(s) * TAU;
    p.rad = Math.min(1.2, Math.sqrt(-2 * Math.log(h32(s + 1) + 1e-6)) * 0.42);
    p.byte = byte; p.hot = byte < 40; p.rc = 0.85 + ((byte & 15) / 15) * 1.75;
  }

  /**
   * Replaces the visualised ciphertext. `n`: wanted number of particles (by
   * default, from the ciphertext size); each keystroke sends a ripple.
   */
  setBytes(bytes: Uint8Array, n?: number) {
    if (this.mode !== "live") return;
    this.bytes = bytes;
    this.energy = 1;
    if (bytes.length && !this.reduce) {
      this.ripples.push({ t0: performance.now(), amp: 1 });
      if (this.ripples.length > 5) this.ripples.shift();
      this.beat = 0;
    }
    this.want(n ?? this.countFor(bytes.length));
  }

  /** Adjusts the cloud's number of particles: it attracts some from the field, or gently gives some back. */
  want(n: number) {
    if (this.mode !== "live") return;
    if (!this.bytes.length) n = 0;
    const live = this.members();
    if (this.hold) n = Math.max(n, live.length);
    for (let i = n; i < live.length; i++) this.letGo(live[i], 1.2);
    this.queue = Math.max(0, n - live.length);
    live.slice(0, n).forEach((p, i) => this.slot(p, i));
  }

  private letGo(p: Particle, kick: number) {
    const i = this.parts.indexOf(p);
    if (i >= 0) this.parts[i] = null;
    const a = Math.random() * TAU, k = kick * this.sc * (0.4 + Math.random() * 0.6);
    field.give(p, this.hx + p.x, this.hy + p.y, p.x - p.ox + Math.cos(a) * k, p.y - p.oy + Math.sin(a) * k);
  }

  /** Burst: each particle leaves from the cloud's centre, then joins the current. */
  private burst() {
    const Z = this.Z;
    for (const p of this.parts) {
      if (!p) continue;
      const dx = p.x - Z.ccx, dy = p.y - Z.ccy, d = Math.hypot(dx, dy) || 1, f = (2.5 + Math.random() * 6.5) * this.sc;
      field.give(p, this.hx + p.x, this.hy + p.y, (p.x - p.ox) * 0.5 + (dx / d) * f + gauss() * 0.8, (p.y - p.oy) * 0.5 + (dy / d) * f + gauss() * 0.8);
    }
    this.parts = []; this.queue = 0; this.hold = false;
    this.mode = "live"; this.choreo = null; this.slices = []; this.pulses = []; this.ripples = [];
    this.charged = null; this.sparks = []; this.sweep = null;
    this.bytes = new Uint8Array(0); this.age = this.ageTarget = 0;
  }

  /** Empties the cloud (type change, new secret, expired secret): the particles go back to the field. */
  clear() {
    for (const p of this.parts) if (p) this.letGo(p, 0.8);
    this.parts = []; this.queue = 0; this.bytes = new Uint8Array(0);
  }

  /** Cloud derived from a seed while the ciphertext is not known yet (reception). */
  seedCloud(seed: string, length: number) {
    const out = new Uint8Array(Math.max(16, length));
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    for (let i = 0; i < out.length; i++) out[i] = Math.floor(h32(h + i * 7919) * 256);
    this.mode = "live"; this.choreo = null;
    this.setBytes(out, this.countFor(out.length));
  }

  /** Gives the cloud the shape of the REAL ciphertext received (receive): the points glide to their new place. */
  reshape(bytes: Uint8Array) {
    if (!bytes.length) return;
    this.bytes = bytes;
    this.members().forEach((p, i) => this.slot(p, i));
  }

  private cloudTarget(p: Particle, spread: number): Pt {
    if (p.line) return p.line;
    const Z = this.Z;
    // differential vortex: the core turns faster than the rim
    const rot = this.reduce ? 0 : this.phase * (0.1 + 0.32 * (1 - Math.min(1, p.rad)));
    const a = p.ang + rot, r = p.rad * spread;
    return { x: Z.ccx + Math.cos(a) * r * Z.rx, y: Z.ccy + Math.sin(a) * r * Z.ry };
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

  // ---------------------------------------------------------------- recrutement

  /** Attracts the missing particles from the field, in small waves: the nearest first. */
  private recruit() {
    if (!this.queue || this.mode !== "live" || !this.Z.cw || !field.ready()) return;
    const k = Math.min(this.queue, 3 + Math.ceil(this.queue * 0.05));
    const got = field.take(k, this.hx + this.Z.ccx, this.hy + this.Z.ccy);
    if (!got.length) { this.queue = 0; return; }
    this.queue -= got.length;
    const base = this.members().length;
    got.forEach((p, j) => {
      const x = p.fx - this.hx, y = p.fy - this.hy, h = Math.random();
      Object.assign(p, {
        x, y, vx: p.fvx, vy: p.fvy, ox: x - p.fvx, oy: y - p.fvy, a: 1, dying: false, kb: 0, spin: Math.random() < 0.5 ? -1 : 1,
        arrived: false, flash: 0, cc: h < 0.4 ? 3 : h < 0.8 ? 4 : 0, // its colour in the cloud: vivid coral or blue, or the ink
        line: null, segs: null, ride: 1, key: false, target: false, flipAt: undefined, s2: undefined, f0: undefined, f1: undefined, gs0: undefined, gs1: undefined,
      });
      this.parts.push(p);
      this.slot(p, base + j);
      if (this.reduce) { const tg = this.cloudTarget(p, 1); p.x = tg.x; p.y = tg.y; p.kb = 1; p.arrived = true; }
    });
  }

  /** A particle has played its part (letter of the link, line): it goes back upstream in the current. */
  private free(i: number) {
    const p = this.parts[i];
    this.parts[i] = null;
    if (p) field.respawn(p);
  }

  // ---------------------------------------------------------------- light and energy

  /** A flash at (x, y): it lights up the particles it touches, often with crackling arcs. */
  private spawnPulse(now: number, x: number, y: number, R: number, arcsP: number, col?: number, dir?: number) {
    this.pulses.push({
      x, y, R, t0: now, dur: 450 + Math.random() * 900, col: col ?? (Math.random() < 0.5 ? 3 : 4), k: 0.7 + Math.random() * 0.7, e: 0, pts: [],
      arcs: Math.random() < arcsP ? 1 + ((Math.random() * 3) | 0) : 0, seed: Math.random() * 1000, dir,
    });
  }

  /**
   * The link is written and the real text has taken over: it keeps some energy.
   * Small flashes appear on its characters (coral on the key, blue on
   * the address) with discharges along the text and sparks, and a
   * sweep of light runs through it now and then. `el`: the link's text
   * (address then key). Drawn behind the text: it stays sharp and readable.
   */
  charge(el: HTMLElement | null) {
    this.charged = el;
    this.nextSweep = performance.now() + 1200;
  }

  /** A flash on a random character of the link. */
  private zapLink(now: number) {
    const el = this.charged;
    if (!el || !el.isConnected) return;
    const spans = el.children.length ? ([...el.children] as HTMLElement[]) : [el];
    const pick = spans[(Math.random() * spans.length) | 0], key = spans.length > 1 && pick === spans[spans.length - 1];
    const lines = [...pick.getClientRects()].filter((r) => r.width > 2);
    if (!lines.length) return;
    const r = lines[(Math.random() * lines.length) | 0], hb = this.o.host.getBoundingClientRect(), sc = this.sc;
    const x = r.left - hb.left + Math.random() * r.width, y = r.top - hb.top + r.height * (0.35 + Math.random() * 0.3), col = key ? 3 : 4;
    this.spawnPulse(now, x, y, (24 + Math.random() * 30) * sc, 1, col, Math.random() < 0.5 ? 0 : Math.PI);
    const last = this.pulses[this.pulses.length - 1];
    last.k = 1.1 + Math.random() * 0.6; // brighter than a flash in the cloud: it has to show under a text
    for (let i = 0, n = 8 + ((Math.random() * 8) | 0); i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 2.4) * sc;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 26 + Math.random() * 30, col });
    }
  }

  /** Energy of the written link: flashes, sparks and sweep, under the text. */
  private drawCharge(ctx: CanvasRenderingContext2D, now: number, dt: number, glowOn: (on: boolean) => void) {
    const el = this.charged;
    if (!el || !el.isConnected || this.reduce) return;
    const sc = this.sc;
    if (Math.random() < 0.032 * dt) this.zapLink(now);
    // now and then, a wave of light runs through the link, line after line
    if (!this.sweep && now > this.nextSweep) this.sweep = { t0: now, dur: 1100 };
    glowOn(true);
    if (this.sweep) {
      const u = (now - this.sweep.t0) / this.sweep.dur;
      if (u >= 1) { this.sweep = null; this.nextSweep = now + 3500 + Math.random() * 2500; }
      else {
        const lines = [...el.getClientRects()].filter((r) => r.width > 2), hb = this.o.host.getBoundingClientRect();
        const total = lines.reduce((s, r) => s + r.width, 0) || 1;
        let acc = 0;
        for (const r of lines) {
          const lu = (u * total - acc) / r.width;
          acc += r.width;
          if (lu < -0.2 || lu > 1.2) continue;
          const x = r.left - hb.left + lu * r.width, y = r.top - hb.top + r.height / 2, w = 64 * sc;
          const g = ctx.createRadialGradient(x, y, 0, x, y, w);
          g.addColorStop(0, mix(field.cols[4], 0.5)); g.addColorStop(0.45, mix(field.cols[3], 0.2)); g.addColorStop(1, mix(field.cols[3], 0));
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - w, y - r.height, w * 2, r.height * 2);
        }
      }
    }
    // sparks: small particles thrown out by the flashes, which slow down and fade
    this.sparks = this.sparks.filter((s) => s.life < s.max);
    for (const s of this.sparks) {
      s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const f = Math.pow(0.9, dt); s.vx *= f; s.vy *= f;
      const a = 1 - s.life / s.max, h = field.halo(s.col);
      if (h) { ctx.globalAlpha = a * 0.8; const R = 6 * sc; ctx.drawImage(h, s.x - R, s.y - R, R * 2, R * 2); }
      ctx.globalAlpha = a; ctx.fillStyle = field.cols[s.col]; ctx.beginPath(); ctx.arc(s.x, s.y, 1.25 * sc, 0, Math.PI * 2); ctx.fill();
    }
    glowOn(false);
  }

  /** Envelope of each flash (short rise, slow fall); returns their sum. */
  private tickPulses(now: number) {
    this.pulses = this.pulses.filter((pu) => now - pu.t0 < pu.dur);
    let surge = 0;
    for (const pu of this.pulses) {
      const u = (now - pu.t0) / pu.dur;
      pu.e = (u < 0.08 ? u / 0.08 : Math.pow(1 - (u - 0.08) / 0.92, 2)) * pu.k;
      surge += pu.e; pu.pts = [];
    }
    return surge;
  }

  /** How much the flashes light up a particle at (x, y); remembers it for the filaments. */
  private boostAt(x: number, y: number) {
    let b = 0;
    for (const pu of this.pulses) {
      const ex = x - pu.x, ey = y - pu.y, d2 = ex * ex + ey * ey, R2 = pu.R * pu.R;
      if (d2 < R2 * 3) { b += Math.exp(-d2 / R2) * pu.e; if (d2 < R2 && pu.pts.length < 140) pu.pts.push(x, y); }
    }
    return b;
  }

  private drawBlooms(ctx: CanvasRenderingContext2D, fade: number) {
    for (const pu of this.pulses) {
      const g = ctx.createRadialGradient(pu.x, pu.y, 0, pu.x, pu.y, pu.R);
      g.addColorStop(0, mix(field.cols[pu.col], Math.min(0.5, 0.3 * pu.e) * fade)); g.addColorStop(1, mix(field.cols[pu.col], 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pu.x, pu.y, pu.R, 0, TAU); ctx.fill();
    }
  }

  /** Energy: a web of filaments between the particles a flash lights up, and arcs from its heart. */
  private drawEnergy(ctx: CanvasRenderingContext2D, fade: number, now: number) {
    const sc = this.sc, ink = field.cols[0];
    for (const pu of this.pulses) {
      if (pu.e < 0.12) continue;
      const P = pu.pts, m = P.length / 2, lim = (pu.R * 0.45) ** 2;
      ctx.strokeStyle = field.cols[pu.col]; ctx.lineWidth = 0.8 * sc; ctx.globalAlpha = Math.min(0.55, 0.4 * pu.e) * fade;
      ctx.beginPath();
      for (let i = 0; i < m; i++) {
        const xi = P[2 * i], yi = P[2 * i + 1];
        let b1 = -1, d1 = lim, b2 = -1, d2 = lim;
        for (let j = 0; j < m; j++) {
          if (j === i) continue;
          const ex = P[2 * j] - xi, ey = P[2 * j + 1] - yi, d = ex * ex + ey * ey;
          if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = j; } else if (d < d2) { d2 = d; b2 = j; }
        }
        if (b1 > i) { ctx.moveTo(xi, yi); ctx.lineTo(P[2 * b1], P[2 * b1 + 1]); }
        if (b2 > i) { ctx.moveTo(xi, yi); ctx.lineTo(P[2 * b2], P[2 * b2 + 1]); }
      }
      ctx.stroke();
      // zigzag discharges, redrawn every frame: they crackle
      const age = now - pu.t0;
      if (pu.arcs && age < 260) {
        const ea = 1 - age / 260;
        for (let k = 0; k < pu.arcs; k++) {
          const ang = pu.dir !== undefined ? pu.dir + (h32(k + ((pu.seed * 3) | 0)) - 0.5) * 0.7 + Math.sin(age * 0.03 + k) * 0.15 : pu.seed + k * 2.1 + Math.sin(age * 0.02 + k) * 0.3;
          const len = pu.R * (pu.dir !== undefined ? 2.2 : 1) * (0.8 + 0.4 * h32(k + ((pu.seed * 7) | 0)));
          const ux = Math.cos(ang), uy = Math.sin(ang), pts: Pt[] = [{ x: pu.x, y: pu.y }];
          for (let s = 1; s <= 8; s++) {
            const f = s / 8, j = (Math.random() - 0.5) * len * 0.22 * (1 - f * 0.5);
            pts.push({ x: pu.x + ux * len * f - uy * j, y: pu.y + uy * len * f + ux * j });
          }
          for (const [w, al, col] of [[3.2 * sc, 0.25, field.cols[pu.col]], [sc, 0.9, ink]] as const) {
            ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = al * ea * fade;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (const q of pts) ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
    }
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
   * Click on "Encrypt": the whole nebula (arrived or still on its way
   * from the background) gathers into an irregular, boiling cluster (3 to 5
   * random lumps, never a disc). Each particle leaves at the
   * speed it already had: no jolt. Resolves once the cluster is formed.
   */
  gather(): Promise<void> {
    if (this.mode !== "live") return Promise.resolve();
    const now = performance.now(), Z = this.Z, sc = this.sc, fm = this.frameMs || 16.67;
    this.mode = "gather"; this.choreo = { t0: now }; this.slices = []; this.queue = 0;
    this.age = this.ageTarget = 0;
    const lumps = Array.from({ length: 3 + ((Math.random() * 3) | 0) }, () => ({
      x: Z.ccx + gauss() * Z.rx * 0.18, y: Z.ccy + gauss() * Z.ry * 0.22, w: 0.45 + Math.random() * 0.8,
    }));
    let end = now;
    for (const p of this.members()) {
      const L = lumps[(Math.random() * lumps.length) | 0];
      const cx = L.x + gauss() * Z.rx * 0.11 * L.w, cy = L.y + gauss() * Z.ry * 0.15 * L.w;
      const T = this.reduce ? 1 : 650 + Math.random() * 550;
      const dx = cx - p.x, dy = cy - p.y, len = Math.hypot(dx, dy) || 1;
      const off = (Math.random() - 0.5) * Math.min(len, 240 * sc) * 0.8;
      const vx = this.reduce ? 0 : (p.x - p.ox) / fm, vy = this.reduce ? 0 : (p.y - p.oy) / fm;
      p.segs = [{ t0: now, t1: now + T, x0: p.x, y0: p.y, vx0: vx, vy0: vy, x1: cx, y1: cy, bx: (-dy / len) * off, by: (dx / len) * off }];
      p.gs0 = now; p.gs1 = now + T; p.nz = Math.random() * 1000; p.ride = 1; p.line = null;
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
      if (p.segs) { const q = this.posAt(p, now); p.x = p.ox = q.x; p.y = p.oy = q.y; p.vx = 0; p.vy = 0; }
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
      else { p.target = false; p.f0 = t1 - 120; p.f1 = t2 + 260; } // spare particles: they melt into the line, then go back upstream
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

  /** Receive: the cloud condenses back onto the characters of `el`; the spare particles go back to the field. */
  condense(el: HTMLElement) {
    this.mode = "forming"; this.queue = 0;
    const live = this.members(), chars = (el.textContent ?? "").replace(/\s/g, "").length || 1;
    // spread the available points over the characters, at most 22 per letter
    const pts = this.glyphPoints(el, Math.max(2, Math.min(22, Math.floor(live.length / chars))));
    for (let k = live.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [live[k], live[j]] = [live[j], live[k]]; }
    let j = 0;
    for (const pt of pts) {
      const p = live[j++]; if (!p) break;
      p.line = pt; p.from = { x: p.x, y: p.y }; p.ride = this.reduce ? 1 : 0;
      p.rideSp = 0.014 + Math.random() * 0.01; p.key = false;
    }
    for (; j < live.length; j++) this.letGo(live[j], 3);
  }

  /** End of the formation: a last flash, then the particles leave the letters and the real text takes over. */
  settle() {
    const now = performance.now(), letters = this.members().filter((p) => p.target);
    if (!this.reduce) for (let k = 0; k < 4 && letters.length; k++) {
      const p = letters[(Math.random() * letters.length) | 0];
      this.spawnPulse(now, p.x, p.y, (36 + Math.random() * 56) * this.sc, 1);
    }
    this.mode = "formed";
    this.parts.forEach((p) => { if (p) p.dying = true; });
  }

  /** Back to the live cloud (new secret). */
  unseal() {
    this.clear();
    this.mode = "live"; this.choreo = null; this.slices = []; this.pulses = []; this.ripples = []; this.hold = false;
    this.charged = null; this.sparks = []; this.sweep = null;
    this.layout();
  }

  // ---------------------------------------------------------------- images

  /** Choreography frames: positions come from the segments, never from springs. */
  private drawChoreo(ctx: CanvasRenderingContext2D, now: number, dt: number) {
    const C = this.choreo!, sc = this.sc, still = this.reduce, G = this.glitchAt(now), cols = field.cols, ink = cols[0], acc = cols[1];
    const add = field.dark, glowOn = (on: boolean) => { if (add) ctx.globalCompositeOperation = on ? "lighter" : "source-over"; };
    // flashes on the link too: a fast charge on the cluster, flashes along the line then on the letters
    const rate = this.mode === "gather" ? 0.075 : this.mode === "write" ? 0.05 : this.mode === "glide" ? 0.035 : 0;
    if (rate && !still && Math.random() < rate * dt) {
      let p: Particle | null = null;
      for (let k = 0; k < 6 && !p; k++) { const c = this.parts[(Math.random() * this.parts.length) | 0]; if (c && !c.dying) p = c; }
      if (p) this.spawnPulse(now, p.x, p.y, (26 + Math.random() * 64) * sc, 0.7);
    }
    this.tickPulses(now);
    glowOn(true); this.drawBlooms(ctx, 1); glowOn(false);
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
        g.addColorStop(0, mix(acc, 0)); g.addColorStop(0.5, mix(acc, al)); g.addColorStop(1, mix(acc, 0));
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x0, C.lineY! - 0.6 * sc, w, 1.2 * sc);
      }
    }
    const boilW = this.mode === "gather" ? 1 : this.mode === "write" && C.wt0 !== undefined ? 1 - smooth(clamp01((now - C.wt0) / 380)) : 0;
    const tick60 = Math.floor(now / 60), tick90 = Math.floor(now / 90);
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; if (!p) continue;
      if (p.f1 !== undefined && now >= p.f1) { this.free(i); continue; }
      p.a += ((p.dying ? 0 : 1) - p.a) * (still ? 1 : Math.min(1, (p.dying ? 0.06 : 0.1) * dt));
      if (p.dying && p.a < 0.02) { this.free(i); continue; }
      let { x, y } = this.posAt(p, now);
      // the cluster simmers slowly, at random (appears on arrival, disappears when the line forms)
      const boil = p.gs1 !== undefined && p.gs0 !== undefined ? smooth(clamp01((now - p.gs0) / (p.gs1 - p.gs0))) * boilW : 0;
      const nz = p.nz ?? 0;
      if (boil > 0 && !still) {
        x += (Math.sin(now * 0.0019 + nz) * 0.6 + Math.sin(now * 0.0047 + nz * 1.7) * 0.4) * 9 * sc * boil;
        y += (Math.sin(now * 0.0023 + nz * 0.8) * 0.6 + Math.sin(now * 0.0041 + nz * 2.3) * 0.4) * 6 * sc * boil;
      }
      p.ox = p.x; p.oy = p.y; p.x = x; p.y = y;
      let ox = 0;
      for (const s of this.slices) if (Math.abs(y - s.y) < s.h / 2) ox += s.dx * Math.sin((Math.PI * (now - s.t0)) / s.dur);
      const q = p.s2 ? smooth(clamp01((now - p.s2.t0) / (p.s2.t1 - p.s2.t0))) : 0, cloudA = 0.45 + (p.byte / 255) * 0.55;
      let a = p.a * (cloudA + (1 - cloudA) * q) * (p.f0 !== undefined && p.f1 !== undefined ? 1 - smooth(clamp01((now - p.f0) / (p.f1 - p.f0))) : 1);
      const seed = (nz * 977) | 0;
      if (G > 0 && h32(seed + tick60) < 0.12 * G) a *= 0.25; // scintillement
      const flipped = p.flipAt !== undefined && now >= p.flipAt, boost = this.boostAt(x, y), px = x + ox;
      const r = (p.rc * (1 - q) + 0.95 * q) * sc * (1 + boost * 0.6);
      a = Math.min(1, a * (1 + boost * 1.4) + boost * 0.25);
      p.da = a; p.dr = r;
      if (a < 0.01) continue;
      const hc = flipped ? (p.key ? 3 : 4) : p.cc;
      if (boost > 0.15 || (!flipped && p.z + 0.3 > 0.72)) {
        const halo = field.halo(hc);
        if (halo) { glowOn(true); ctx.globalAlpha = a * Math.min(1, 0.45 + boost); const Rh = r * 5; ctx.drawImage(halo, px - Rh, y - Rh, Rh * 2, Rh * 2); glowOn(false); }
      }
      ctx.globalAlpha = a; ctx.fillStyle = flipped ? (p.key ? acc : ink) : cols[p.cc];
      if (G > 0.3 && !flipped && h32(seed + 7) < 0.35) ctx.fillRect(px - r, y - r, r * 2, r * 2); // some turn into square pixels
      else { ctx.beginPath(); ctx.arc(px, y, r, 0, TAU); ctx.fill(); }
      if (G > 0 && h32(seed + 13 + tick90) < 0.1 * G) { // colour split
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = acc; ctx.fillRect(px + 2.5 * sc - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = ink; ctx.fillRect(px - 2 * sc - r, y - r, r * 2, r * 2);
      }
    }
    if (!still) { glowOn(true); this.drawEnergy(ctx, 1, now); glowOn(false); }
    if (this.mode === "formed") this.drawCharge(ctx, now, dt, glowOn);
  }

  /** One frame of the cloud, drawn by the field on its canvas (host coordinates). */
  frame(ctx: CanvasRenderingContext2D, now: number, dt: number) {
    const b = this.o.host.getBoundingClientRect();
    this.hx = b.left; this.hy = b.top;
    if (!b.width || !this.Z.cw) return;
    this.time += dt / 60; this.frameMs = dt * 16.67;
    const Z = this.Z, still = this.reduce, sc = this.sc, cols = field.cols, ink = cols[0], acc = cols[1];
    this.age += (this.ageTarget - this.age) * (still ? 1 : Math.min(1, 0.14 * dt));
    if (Math.abs(this.age - this.ageTarget) < 0.0005) this.age = this.ageTarget;
    this.energy *= Math.pow(0.965, dt);
    if (!still) this.phase += (dt / 60) * (1 + this.energy * 2.4);
    this.recruit();
    ctx.save(); ctx.translate(this.hx, this.hy);
    if (this.choreo) { this.drawChoreo(ctx, now, dt); ctx.restore(); return; }

    const t = this.age, fade = Math.pow(1 - t, 1.25), live = this.mode === "live", has = this.bytes.length > 0;
    const spread = (1 + t * 0.9) * (still ? 1 : 1 + 0.025 * Math.sin(this.time * 1.3)), cool = cols[4];
    // random flashes in the cloud, more frequent while typing
    if (live && has && !still && fade > 0.01 && Math.random() < (0.014 + this.energy * 0.05) * dt) {
      const pa = Math.random() * TAU, pr = Math.sqrt(Math.random()) * 0.8;
      this.spawnPulse(now, Z.ccx + Math.cos(pa) * pr * Z.rx, Z.ccy + Math.sin(pa) * pr * Z.ry, (0.22 + Math.random() * 0.35) * Z.rx, 0.6);
    }
    const surge = this.tickPulses(now);
    // at night, lights add up where they overlap (the dots themselves keep their exact colour)
    const add = live && field.dark, glowOn = (on: boolean) => { if (add) ctx.globalCompositeOperation = on ? "lighter" : "source-over"; };
    glowOn(true);
    // a nebula glow at the heart of the cloud: it grows with it, breathes, flares while typing
    if (live && this.fill > 0.01 && fade > 0.01) {
      const R = Z.rx * 1.2 * spread, k0 = Math.min(0.42, (0.2 + 0.06 * Math.sin(this.time * 0.9)) * this.fill * fade * (1 + this.energy * 0.6 + surge * 0.5));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, mix(acc, k0)); g.addColorStop(0.35, mix(cool, k0 * 0.55)); g.addColorStop(1, mix(cool, 0));
      ctx.save(); ctx.translate(Z.ccx, Z.ccy); ctx.scale(1, (Z.ry / (Z.rx || 1)) * 1.35);
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      const c = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
      c.addColorStop(0, mix(ink, k0 * 0.45)); c.addColorStop(1, mix(ink, 0));
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, R * 0.32, 0, TAU); ctx.fill(); ctx.restore();
    }
    this.drawBlooms(ctx, fade);
    // at rest, the cloud keeps a heartbeat: a softer ripple every 4 s
    if (live && has && !still) {
      this.beat += dt / 60;
      if (this.beat > 4) { this.beat = 0; this.ripples.push({ t0: now, amp: 0.45 }); }
    }
    // keystroke ripples: a thin ring runs out from the centre
    this.ripples = this.ripples.filter((rp) => now - rp.t0 < 1100);
    if (live && fade > 0.01) for (const rp of this.ripples) {
      const u = (now - rp.t0) / 1100, f = u * 1.5;
      ctx.globalAlpha = 0.22 * rp.amp * (1 - u) * (1 - u) * fade; ctx.strokeStyle = acc; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Z.ccx, Z.ccy, Math.max(1, f * Z.rx * spread), Math.max(1, f * Z.ry * spread), 0, 0, TAU); ctx.stroke();
    }
    glowOn(false);

    if (this.ring && has && live && fade > 0.01) {
      ctx.save(); ctx.globalAlpha = 0.4 * fade; ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = still ? 0 : -this.time * 12;
      ctx.beginPath(); ctx.ellipse(Z.ccx, Z.ccy, Z.rx * 1.15 * spread, Z.ry * 1.45 * spread, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }

    const k = live ? 0.02 : 0.045, flowAmp = (live ? 0.08 : 0.004) * (1 + t * 3), R = (Z.stacked ? 56 : 90) * sc;
    // the cloud only parts when the pointer is over it (not while typing)
    const near = this.ptr.on && this.ptr.x > Z.cx0 - 20 && this.ptr.x < Z.cx1 + 20 && this.ptr.y > Z.top - 20 && this.ptr.y < Z.bot + 20;
    const halo = (col: number) => field.halo(col);
    const dotC: Dot = (x, y, r, al, col, z) => {
      const h = z > 0.72 ? halo(col) : undefined;
      if (h) { glowOn(true); ctx.globalAlpha = al * 0.55; const Rh = r * 5; ctx.drawImage(h, x - Rh, y - Rh, Rh * 2, Rh * 2); glowOn(false); }
      ctx.globalAlpha = al; ctx.fillStyle = cols[col]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    };
    let count = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; if (!p) continue;
      p.ox = p.x; p.oy = p.y; // previous position: the choreography and the return to the field start at the current speed
      p.a += ((p.dying ? 0 : 1) - p.a) * (still ? 1 : p.dying ? 0.05 : 0.07);
      if (p.dying && p.a < 0.02) { this.free(i); continue; }
      const tg = this.cloudTarget(p, live ? spread : 1);
      if (p.ride < 1 && !still) {
        // receive: a curved path to its letter
        p.ride = Math.min(1, p.ride + p.rideSp * dt);
        const e = ease(p.ride), c = this.curve(p.from, tg), q = bez(c, e), q2 = bez(c, Math.min(1, e + 0.01));
        p.vx = (q2.x - q.x) * 3; p.vy = (q2.y - q.y) * 3; p.x = q.x; p.y = q.y;
      } else if (!still) {
        const dx = tg.x - p.x, dy = tg.y - p.y, dist = Math.hypot(dx, dy) || 1;
        let ax = dx * k, ay = dy * k;
        // attracted from far away: a capped pull with a sideways swirl, to spiral in
        const m = Math.hypot(ax, ay), cap = 0.5 * sc;
        if (m > cap) { ax *= cap / m; ay *= cap / m; }
        if (live && dist > 30 * sc) { const f = Math.min(1, dist / (220 * sc)) * 0.32 * sc * p.spin; ax += (-dy / dist) * f; ay += (dx / dist) * f; }
        ax += Math.sin(p.y * 0.013 + this.time * 0.7 + p.ang * 50) * flowAmp;
        ay += Math.cos(p.x * 0.011 - this.time * 0.55 + p.ang * 65) * flowAmp;
        if (live && near) {
          const ex = p.x - this.ptr.x, ey = p.y - this.ptr.y, d2 = ex * ex + ey * ey;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 1.5; ax += (ex / d) * f; ay += (ey / d) * f; }
        }
        // a ripple's front pushes away the particles it crosses; the pull brings them back
        if (live && p.arrived) for (const rp of this.ripples) {
          const u = (now - rp.t0) / 1100, dd = p.rad * spread - u * 1.5;
          if (Math.abs(dd) < 0.2) {
            const rx0 = p.x - Z.ccx, ry0 = p.y - Z.ccy, rl = Math.hypot(rx0, ry0) || 1, f = (1 - Math.abs(dd) / 0.2) * (1 - u) * 1.1 * rp.amp * sc;
            ax += (rx0 / rl) * f; ay += (ry0 / rl) * f;
          }
        }
        // a particle reaching its place lights up for a moment
        if (live && !p.arrived && dist < 9 * sc) { p.arrived = true; p.flash = 1; }
        const damp = live ? 0.87 + 0.065 * clamp01((dist - 40 * sc) / (160 * sc)) : 0.78, dm = Math.pow(damp, dt);
        p.vx = (p.vx + ax * dt) * dm; p.vy = (p.vy + ay * dt) * dm;
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else { p.x = tg.x; p.y = tg.y; }
      p.kb = Math.min(1, p.kb + (still ? 1 : 0.012 * dt));
      if (!p.dying) count++;
      if (live && p.arrived && !still && Math.random() < 0.003 * dt) p.flash = Math.max(p.flash, 0.6); // scintillement
      const kb = smooth(p.kb), rTo = live ? p.rc : 0.95, aTo = live ? 0.55 + (p.byte / 255) * 0.45 : 1;
      const tw = live && !still ? 0.72 + 0.28 * Math.sin(this.time * (p.tw * 2.2) + p.tph) : 1;
      const r = (p.r0 + (rTo - p.r0) * kb) * sc, a = p.a * (p.line ? 1 : fade) * (p.a0 + (aTo - p.a0) * kb) * tw;
      p.da = a; p.dr = r;
      if (a < 0.01) continue;
      if (p.flash > 0.02) {
        const h = halo(p.hot ? 3 : p.cc);
        if (h) { glowOn(true); ctx.globalAlpha = Math.min(1, p.flash * 0.9) * fade; const Rf = r * (5 + 5 * p.flash); ctx.drawImage(h, p.x - Rf, p.y - Rf, Rf * 2, Rf * 2); glowOn(false); }
        if (!still) p.flash *= Math.pow(0.93, dt);
      }
      if (p.line && p.ride >= 1) { ctx.globalAlpha = a; ctx.fillStyle = p.key ? acc : ink; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
      else {
        const boost = this.boostAt(p.x, p.y);
        const rr = r * (1 + p.flash * 0.6 + boost * 0.7), aa = Math.min(1, a * (1 + boost * 1.4) + p.flash * 0.4 + boost * 0.25);
        // on its way in, the particle fades from its colour to the cloud's; "hot" bytes glow in coral
        const tc = p.hot && live ? 3 : p.cc, z = (p.hot && live) || boost > 0.25 ? 1 : p.z + 0.3 * kb;
        if (tc !== p.col && kb < 0.99) { dotC(p.x, p.y, rr, aa * (1 - kb), p.col, z); dotC(p.x, p.y, rr, aa * kb, tc, z); }
        else dotC(p.x, p.y, rr, aa, tc, z);
      }
    }
    if (!still) { glowOn(true); this.drawEnergy(ctx, fade, now); glowOn(false); }
    this.fill += (Math.min(1, count / Math.max(1, this.cap())) - this.fill) * Math.min(1, 0.05 * dt);
    if (this.parts.length > 4000) this.parts = this.parts.filter(Boolean);

    if (has && fade > 0.01 && live && this.reads > 0 && this.o.direction === "out") {
      const n = Math.min(this.reads, 20), gap = 12 * sc, x0 = Z.ccx - ((n - 1) * gap) / 2, y = Z.bot - 6 * sc;
      ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = acc;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, 3 * sc, 0, TAU); ctx.fill(); }
    }
    if (t > 0.995 && this.destroyedLabel) {
      ctx.fillStyle = ink; ctx.globalAlpha = 0.9; ctx.textAlign = "center";
      ctx.font = `500 ${Math.round((Z.stacked ? 15 : 19) * sc)}px ${getComputedStyle(this.o.host).fontFamily}`;
      ctx.fillText(this.destroyedLabel, Z.ccx, Z.ccy);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
