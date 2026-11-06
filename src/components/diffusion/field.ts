/**
 * The field — every particle of the site, on one canvas behind the
 * pages (mounted by `Space`, in the root layout: it survives navigations).
 *
 * In the background, the particles follow a slow diagonal current that meanders and
 * breathes; each one twirls on its own orbit (its own radius, speed and
 * direction): no shared field, they never move as a shoal. Behind them, far
 * stars and nebula glows.
 *
 * The clouds of the send and receive screens (`DiffusionScene`) BORROW
 * their particles from the field (`take`) and give them back (`give`): gently
 * when fewer are needed, in a burst when the page is left. Those that
 * wrote a link come back upstream, off screen (`respawn`). Nothing follows the
 * scroll; the pointer barely shifts the depths. Colours read from the
 * theme tokens, read again on every switch. `prefers-reduced-motion`: a still
 * sky.
 *
 * Client uniquement (canvas, getComputedStyle).
 */

export type Pt = { x: number; y: number };

/**
 * Choreography segment: cubic Hermite from (x0, y0) to (x1, y1) over
 * [t0, t1] ms, leaving at velocity (vx0, vy0) px/ms, arriving at rest, plus a
 * lateral bulge (bx, by) whose slope is zero at both ends.
 */
export type Seg = { t0: number; t1: number; x0: number; y0: number; vx0: number; vy0: number; x1: number; y1: number; bx: number; by: number };

export type Particle = {
  mode: "free" | "bound";
  // life in the field: place in the current (s along it, q in half-widths), depth, pace
  z: number; s: number; q: number; v: number; r0: number; a0: number; col: number; w: number; ph: number;
  // orbite propre (rad/s, rayon), scintillement
  ow: number; orr: number; oph: number; tw: number; tph: number;
  // push that dies down (px/frame), offset that dies down, fade-in, return from a cloud (fade)
  ex: number; ey: number; gx: number; gy: number; fa: number; rb: number; ra: number; rr: number; relCol: number | null;
  // position drawn on screen, previous frame, speed when borrowed
  fx: number; fy: number; pfx: number; pfy: number; fvx: number; fvy: number;
  // lent to a cloud: coordinates of its host
  x: number; y: number; vx: number; vy: number; ox: number; oy: number; a: number; da: number; dr: number;
  dying: boolean; kb: number; spin: number; arrived: boolean; flash: number; cc: number;
  // place in the cloud (normalised polar coordinates), the byte that sets it
  ang: number; rad: number; byte: number; hot: boolean; rc: number;
  // guided path (0 → 1) from `from`; fixed target (a letter of the secret, on receive)
  ride: number; rideSp: number; from: Pt; line: Pt | null; key: boolean;
  // send choreography
  segs: Seg[] | null; gs0?: number; gs1?: number; nz?: number; target?: boolean; flipAt?: number; s2?: Seg; f0?: number; f1?: number;
};

/** A dot drawn by the field: round, with a soft halo on the nearest ones (z > 0.72). */
export type Dot = (x: number, y: number, r: number, al: number, col: number, z: number) => void;

/** A cloud that draws its particles on the field's canvas, on every frame. */
export interface FieldClient {
  frame(ctx: CanvasRenderingContext2D, now: number, dt: number): void;
}

const TAU = Math.PI * 2;
// the stream's axis: to the right, rising slightly
const TH = -0.32;
const U = { x: Math.cos(TH), y: Math.sin(TH) };
const NV = { x: -Math.sin(TH), y: Math.cos(TH) };
// nebula glows, placed on the stream (s: position along it, q: offset)
const GLOWS = [
  { s: 0.26, q: 0, col: 1, a: 0.075, r: 0.42 },
  { s: -0.3, q: 0.4, col: 2, a: 0.07, r: 0.5 },
  { s: -0.12, q: -3.2, col: 1, a: 0.03, r: 0.38 },
];

/** Deterministic pseudo-random: the same sky on every resize. */
export function h32(a: number): number {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** #rrggbb + alpha → rgba() (canvas gradients do not read color-mix). */
export function mix(col: string, a: number) {
  if (col[0] !== "#" || col.length !== 7) return col;
  return `rgba(${parseInt(col.slice(1, 3), 16)},${parseInt(col.slice(3, 5), 16)},${parseInt(col.slice(5, 7), 16)},${a})`;
}

/** More saturated version of a #rrggbb colour (the clouds' coral and blue). */
function vivid(hex: string, ks: number, dl: number) {
  if (hex[0] !== "#" || hex.length !== 7) return hex;
  let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = d ? d / (1 - Math.abs(2 * l0 - 1)) : 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  if (h < 0) h += 6;
  s = Math.min(1, s * ks);
  const l = Math.max(0, Math.min(1, l0 + dl)), c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
  [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

class Field {
  private cv: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private glow: HTMLCanvasElement | null = null;
  private gtx: CanvasRenderingContext2D | null = null;
  private W = 0;
  private H = 0;
  private L = 0;
  private WN = 0;
  private t = 0;
  private n = 0;
  private seed = 1;
  private last = 0;
  private raf = 0;
  private area = 0;
  private parts: Particle[] = [];
  private stars: { x: number; y: number; r: number; a: number; tw: number; ph: number; d: number }[] = [];
  private clients: FieldClient[] = [];
  private halos: HTMLCanvasElement[] = [];
  private ptr = { x: 0, y: 0 };
  private look = { x: 0, y: 0 };
  private A: Pt = { x: 0, y: 0 };
  private reduce: MediaQueryList | null = null;
  /** Page font size / 16: the scale of radii and speeds. */
  sc = 1;
  /** ink, accent, blue, then saturated accent and blue (clouds) */
  cols = ["#e4e9f0", "#ff7a59", "#6a92ff", "#ff6b47", "#5b86ff"];
  /** Dark theme: the clouds' lights add up. */
  dark = true;

  private rnd = () => h32(this.seed++ * 7919 + 13);
  private gs = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, this.rnd()))) * Math.cos(TAU * this.rnd());
  private centre = (s: number) =>
    this.WN * (0.1 * Math.sin((TAU * s) / (1.7 * this.L) + 0.6 + this.t * 0.035) + 0.045 * Math.sin((TAU * s) / (0.8 * this.L) + 2.1 - this.t * 0.05));
  private half = (s: number) => this.WN * (0.11 + 0.035 * Math.sin((TAU * s) / (1.1 * this.L) + this.t * 0.04));
  private at(s: number, q: number, out: Pt) {
    const d = this.centre(s) + q * this.half(s);
    out.x = this.W / 2 + U.x * s + NV.x * d; out.y = this.H / 2 + U.y * s + NV.y * d;
    return out;
  }
  /** The heart of the current, or the whole sky for nearly a third of the particles. */
  private lane(p: Particle) { p.q = this.rnd() < 0.3 ? (this.rnd() * 2 - 1) * 4.5 : this.gs() * 0.8; }

  private make(): Particle {
    const z = this.rnd(), k = this.rnd();
    const p: Particle = {
      mode: "free", z, s: (this.rnd() - 0.5) * this.L, q: 0,
      v: 0.42 * (0.35 + 1.1 * z ** 1.5) * (0.85 + 0.3 * this.rnd()), r0: 0.55 + 1.25 * z * z, a0: 0.24 + 0.6 * z,
      col: k < 0.17 ? 1 : k < 0.29 ? 2 : 0, w: 0.05 + this.rnd() * 0.15, ph: this.rnd() * TAU,
      ow: (this.rnd() < 0.5 ? -1 : 1) * (0.45 + this.rnd() * 1.05), orr: (4 + this.rnd() * 14) * (0.4 + z), oph: this.rnd() * TAU,
      tw: 0.3 + this.rnd() * 1.2, tph: this.rnd() * TAU,
      ex: 0, ey: 0, gx: 0, gy: 0, fa: 1, rb: 0, ra: 0, rr: 0, relCol: null, fx: 0, fy: 0, pfx: 0, pfy: 0, fvx: 0, fvy: 0,
      x: 0, y: 0, vx: 0, vy: 0, ox: 0, oy: 0, a: 1, da: 0, dr: 0, dying: false, kb: 0, spin: 1, arrived: false, flash: 0, cc: 0,
      ang: 0, rad: 0, byte: 0, hot: false, rc: 1, ride: 1, rideSp: 0, from: { x: 0, y: 0 }, line: null, key: false, segs: null,
    };
    this.lane(p);
    return p;
  }

  private makeHalo(col: string) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, mix(col, 0.5)); gr.addColorStop(0.3, mix(col, 0.16)); gr.addColorStop(1, mix(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    return c;
  }

  private readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue("--fx-ink").trim() || this.cols[0];
    const acc = cs.getPropertyValue("--fx-accent").trim() || this.cols[1];
    const cool = cs.getPropertyValue("--fx-cool").trim() || this.cols[2];
    const bg = cs.getPropertyValue("--color-bg").trim() || "#07090d";
    this.dark = bg[0] === "#" && bg.length === 7 ? parseInt(bg.slice(1, 3), 16) + parseInt(bg.slice(3, 5), 16) + parseInt(bg.slice(5, 7), 16) < 384 : true;
    this.cols = [ink, acc, cool, vivid(acc, 1.35, this.dark ? 0.02 : -0.04), vivid(cool, 1.45, this.dark ? 0.04 : -0.04)];
    this.halos = this.cols.map((c) => this.makeHalo(c));
    this.n = 0; // the glows are redrawn in the new colours
  };

  private resize = () => {
    const cv = this.cv, ctx = this.ctx;
    if (!cv || !ctx || !this.glow) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    cv.width = Math.round(this.W * dpr); cv.height = Math.round(this.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.glow.width = Math.ceil(this.W / 4); this.glow.height = Math.ceil(this.H / 4);
    this.sc = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    // every point of the screen projects within ±L/2 on the axis: the wrap-around stays off screen
    this.L = this.W * Math.abs(U.x) + this.H * Math.abs(U.y) + 120;
    this.WN = this.W * Math.abs(NV.x) + this.H * Math.abs(NV.y);
    // the population follows the screen; a particle lent to a cloud is never removed
    const N = Math.round(Math.min(2000, Math.max(500, (this.W * this.H) / 1000)));
    while (this.parts.length < N) this.parts.push(this.make());
    for (let i = this.parts.length - 1; i >= 0 && this.parts.length > N; i--) if (this.parts[i].mode === "free") this.parts.splice(i, 1);
    if (this.area !== this.W * this.H) {
      this.area = this.W * this.H;
      this.stars = Array.from({ length: Math.round(this.area / 4200) }, () => ({
        x: this.rnd() * this.W, y: this.rnd() * this.H, r: 0.35 + this.rnd() * 0.75, a: 0.12 + this.rnd() * 0.4,
        tw: 0.3 + this.rnd() * 1.2, ph: this.rnd() * TAU, d: this.rnd(),
      }));
    }
    this.n = 0;
  };

  /** Where a free particle is drawn, before its offset that dies down. */
  private place(p: Particle, out: Pt) {
    this.at(p.s, p.q + 0.07 * Math.sin(this.t * p.w * TAU + p.ph), out);
    const oa = this.t * p.ow + p.oph, sc = this.sc;
    out.x += Math.cos(oa) * p.orr * sc - this.look.x * (6 + 28 * p.z);
    out.y += Math.sin(oa) * p.orr * sc - this.look.y * (4 + 18 * p.z);
    return out;
  }

  private dot: Dot = (x, y, r, al, col, z) => {
    const ctx = this.ctx!;
    if (z > 0.72 && this.halos[col]) { ctx.globalAlpha = al * 0.55; const R = r * 5; ctx.drawImage(this.halos[col], x - R, y - R, R * 2, R * 2); }
    ctx.globalAlpha = al; ctx.fillStyle = this.cols[col]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  };

  private frame = (now: number) => {
    const ctx = this.ctx, gtx = this.gtx, glow = this.glow;
    if (!ctx || !gtx || !glow) return;
    const still = !!this.reduce?.matches, dt = Math.min(2.5, (now - this.last) / 16.67), sc = this.sc;
    this.last = now;
    if (!still) this.t += dt / 60;
    const e = still ? 1 : 1 - Math.pow(0.96, dt), look = this.look, A = this.A, cols = this.cols;
    look.x += (this.ptr.x - look.x) * e; look.y += (this.ptr.y - look.y) * e;
    ctx.clearRect(0, 0, this.W, this.H);
    // nebula glows along the current: they change slowly, drawn at a quarter resolution now and then
    if (this.n++ % 20 === 0) {
      gtx.clearRect(0, 0, glow.width, glow.height);
      for (const g of GLOWS) {
        this.at(g.s * this.L + Math.sin(this.t * 0.02 + g.s * 9) * 0.04 * this.L, g.q, A);
        const R = (g.r * this.WN * (1 + 0.06 * Math.sin(this.t * 0.05 + g.s * 5))) / 4;
        const gr = gtx.createRadialGradient(A.x / 4, A.y / 4, 0, A.x / 4, A.y / 4, R);
        gr.addColorStop(0, mix(cols[g.col], g.a)); gr.addColorStop(1, mix(cols[g.col], 0));
        gtx.fillStyle = gr; gtx.fillRect(0, 0, glow.width, glow.height);
      }
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(glow, 0, 0, this.W, this.H);
    // far stars: same direction, slower than anything
    ctx.fillStyle = cols[0];
    for (const s of this.stars) {
      if (!still) {
        s.x += U.x * 0.03 * sc * dt; s.y += U.y * 0.03 * sc * dt;
        if (s.x > this.W + 2) s.x -= this.W + 4;
        if (s.y < -2) s.y += this.H + 4;
      }
      ctx.globalAlpha = s.a * (still ? 1 : 0.6 + 0.4 * Math.sin(this.t * s.tw + s.ph));
      ctx.fillRect(s.x - look.x * (3 + 6 * s.d) - s.r, s.y - look.y * (2 + 4 * s.d) - s.r, s.r * 2, s.r * 2);
    }
    for (const p of this.parts) {
      if (p.mode !== "free") continue;
      if (!still) {
        p.s += p.v * sc * dt;
        // a push (return from a cloud, burst) moves the particle's place in the current, then dies down
        if (p.ex || p.ey) {
          p.s += (p.ex * U.x + p.ey * U.y) * dt;
          p.q += ((p.ex * NV.x + p.ey * NV.y) * dt) / (this.half(p.s) || 1);
          const f = Math.pow(0.955, dt); p.ex *= f; p.ey *= f;
          if (Math.abs(p.ex) + Math.abs(p.ey) < 0.005) p.ex = p.ey = 0;
        }
        if (p.s > this.L / 2) { p.s -= this.L; this.lane(p); p.gx = p.gy = 0; p.fa = 0; p.rb = 0; }
        else if (p.s < -this.L / 2 - 200) p.s += this.L;
        const g = Math.pow(0.97, dt); p.gx *= g; p.gy *= g;
        if (p.fa < 1) p.fa = Math.min(1, p.fa + 0.02 * dt);
      }
      this.place(p, A);
      p.pfx = p.fx; p.pfy = p.fy; p.fx = A.x + p.gx; p.fy = A.y + p.gy;
      const q = p.q, tw = still ? 1 : 0.7 + 0.3 * Math.sin(this.t * p.tw + p.tph);
      let al = p.a0 * (0.35 + 0.65 * Math.exp(-(q * q) / 5.1)) * tw * p.fa, r = p.r0 * sc;
      // back from a cloud: its brightness and colour fade to the background's
      if (p.rb > 0.01) { al += (p.ra - al) * p.rb; r += (p.rr - r) * p.rb; if (!still) p.rb *= Math.pow(0.975, dt); }
      if (al <= 0.01) continue;
      if (p.rb > 0.01 && p.relCol !== null && p.relCol !== p.col) { this.dot(p.fx, p.fy, r, al * (1 - p.rb), p.col, p.z); this.dot(p.fx, p.fy, r, al * p.rb, p.relCol, p.z); }
      else this.dot(p.fx, p.fy, r, al, p.col, p.z);
    }
    for (const c of this.clients) c.frame(ctx, now, dt);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (!still || this.clients.length) this.raf = requestAnimationFrame(this.frame);
  };

  private wake = () => { cancelAnimationFrame(this.raf); this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); };
  private onPointer = (e: PointerEvent) => { this.ptr.x = e.clientX / (this.W || 1) - 0.5; this.ptr.y = e.clientY / (this.H || 1) - 0.5; };

  /** Mounts the field on a canvas (once, from the root layout); returns how to unmount it. */
  mount(cv: HTMLCanvasElement) {
    const ctx = cv.getContext("2d"), glow = document.createElement("canvas"), gtx = glow.getContext("2d");
    if (!ctx || !gtx) return () => {};
    this.cv = cv; this.ctx = ctx; this.glow = glow; this.gtx = gtx;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.readColors(); this.resize();
    // a theme switch rewrites data-theme on <html>: re-read the colors
    const mo = new MutationObserver(() => { requestAnimationFrame(this.readColors); this.wake(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const onResize = () => { this.resize(); this.wake(); };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    this.reduce.addEventListener("change", this.wake);
    this.wake();
    // development only (stripped from the production build): steps the field frame by frame,
    // to inspect the animation in a tab the browser pauses (automated tests)
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __ppushStep?: (k: number) => void }).__ppushStep = (k: number) => {
        for (let i = 0; i < k; i++) { cancelAnimationFrame(this.raf); this.frame(this.last + 16.67); }
      };
    }
    return () => {
      cancelAnimationFrame(this.raf);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", this.onPointer);
      this.reduce?.removeEventListener("change", this.wake);
      this.cv = this.ctx = null;
    };
  }

  attach(c: FieldClient) { if (!this.clients.includes(c)) this.clients.push(c); this.wake(); }
  detach(c: FieldClient) { this.clients = this.clients.filter((x) => x !== c); }
  size() { return this.parts.length; }
  halo(col: number) { return this.halos[col]; }
  /** Is the field mounted? (without it, a cloud has nothing to borrow) */
  ready() { return !!this.ctx; }

  /** Lends up to k free particles, preferably the nearest to (cx, cy) on screen, with their speed. */
  take(k: number, cx: number, cy: number): Particle[] {
    const W = this.W, H = this.H;
    const free = this.parts.filter((p) => p.mode === "free" && p.fa > 0.6 && p.fx > -40 && p.fx < W + 40 && p.fy > -40 && p.fy < H + 40);
    const out: Particle[] = [];
    while (out.length < k && free.length) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < 8; c++) {
        const i = (Math.random() * free.length) | 0, p = free[i], d = (p.fx - cx) ** 2 + (p.fy - cy) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      const p = free[best];
      free[best] = free[free.length - 1]; free.pop();
      p.mode = "bound"; p.fvx = p.fx - p.pfx; p.fvy = p.fy - p.pfy;
      out.push(p);
    }
    return out;
  }

  /** Takes a particle back at (x, y) on screen, with its speed: it joins the current without a jump. */
  give(p: Particle, x: number, y: number, vx: number, vy: number) {
    const A = this.A;
    p.mode = "free";
    const dx = x - this.W / 2, dy = y - this.H / 2;
    p.s = dx * U.x + dy * U.y;
    p.q = (dx * NV.x + dy * NV.y - this.centre(p.s)) / (this.half(p.s) || 1);
    const sv = p.v * this.sc;
    p.ex = vx - U.x * sv; p.ey = vy - U.y * sv;
    this.place(p, A);
    p.gx = x - A.x; p.gy = y - A.y; p.fx = x; p.fy = y; p.pfx = x - vx; p.pfy = y - vy; p.fa = 1;
    p.ra = p.da || p.a0; p.rr = p.dr || p.r0 * this.sc; p.rb = 1; p.relCol = p.cc;
  }

  /** A particle that wrote a link comes back upstream, off screen, and fades in. */
  respawn(p: Particle) {
    p.mode = "free"; p.s = -this.L / 2 - this.rnd() * 80; this.lane(p);
    p.ex = p.ey = p.gx = p.gy = 0; p.fa = 0; p.rb = 0; p.relCol = null;
  }
}

/** The site's field (only one, for every page). */
export const field = new Field();
