import fs from "node:fs";
import { blobDir, config } from "./config";
import { alert } from "./alert";

/**
 * Global safeguards against flooding, on top of the per-IP limits of
 * ratelimit.ts (which many addresses can get around):
 *  - beyond `shield*PerHour` anonymous creations accepted in the hour, the
 *    "shield" turns on: Turnstile becomes mandatory to create without an
 *    account for `shieldMinutes` (a human gets through, a script doesn't);
 *  - beyond `close*PerHour`, no more anonymous creation until the end
 *    of the window; accounts keep working;
 *  - low disk space: anonymous creation is refused, then all of it.
 *
 * Only ACCEPTED creations are counted: a bot hammering away without
 * solving Turnstile doesn't flip the site to "closed" for humans.
 * In memory, single instance (like ratelimit.ts): a restart resets everything.
 */

const HOUR = 3_600_000;
type Win = { start: number; count: number };
const wins = new Map<string, Win>();

function current(key: string): Win {
  const now = Date.now();
  let w = wins.get(key);
  if (!w || now - w.start >= HOUR) {
    w = { start: now, count: 0 };
    wins.set(key, w);
  }
  return w;
}

let shieldUntil = 0;
/** IPs that passed Turnstile during the shield: exempt until it ends. */
const cleared = new Map<string, number>();

// ---- disque ----------------------------------------------------------------

let diskCache = { at: 0, freeMb: Infinity };

function freeMb(dir: string): number {
  try {
    const s = fs.statfsSync(fs.existsSync(dir) ? dir : config.dataDir);
    return (s.bavail * s.bsize) / 1_048_576;
  } catch {
    return Infinity; // can't measure: don't block on a read error
  }
}

/** Lowest free space (MB) between the database and the files; cached for 30 s. */
export function diskFreeMb(): number {
  const now = Date.now();
  if (now - diskCache.at > 30_000) {
    diskCache = { at: now, freeMb: Math.min(freeMb(config.dataDir), freeMb(blobDir())) };
  }
  return diskCache.freeMb;
}

// ---- portes ------------------------------------------------------------------

export type AnonKind = "push" | "blob";
/** ok | captcha (Turnstile required) | closed (creation paused) | disk (not enough space) */
export type Gate = "ok" | "captcha" | "closed" | "disk";

const g = config.guard;

/** Decision for a creation WITHOUT an account. Records nothing: call `accept` afterwards. */
export function anonGate(kind: AnonKind, ip: string): Gate {
  const free = diskFreeMb();
  if (free < g.diskMinFreeAnonMb) {
    alert("disk-anon", "low disk space", `${Math.round(free)} MB free: anonymous creation refused`);
    return "disk";
  }
  const close = kind === "push" ? g.closeAnonPushesPerHour : g.closeAnonBlobsPerHour;
  if (current(`anon:${kind}`).count >= close || current("all:push").count >= g.closeAllPushesPerHour) {
    alert(`closed-${kind}`, "anonymous creation closed", `hourly ceiling reached (${kind}: ${close})`);
    return "closed";
  }
  const now = Date.now();
  if (now < shieldUntil && config.turnstileSecret) {
    return (cleared.get(ip) ?? 0) > now ? "ok" : "captcha";
  }
  return "ok";
}

/** Decision for a creation WITH an account: only the disk and the global ceiling matter. */
export function userGate(): Gate {
  const free = diskFreeMb();
  if (free < g.diskMinFreeMb) {
    alert("disk-all", "disk almost full", `${Math.round(free)} MB free: all creation refused`);
    return "disk";
  }
  if (current("all:push").count >= g.closeAllPushesPerHour) {
    alert("closed-all", "all creation closed", `hourly ceiling reached (${g.closeAllPushesPerHour})`);
    return "closed";
  }
  return "ok";
}

/** The IP solved Turnstile: exempt until the shield ends. */
export function clearIp(ip: string): void {
  cleared.set(ip, Math.max(shieldUntil, Date.now() + g.shieldMinutes * 60_000));
}

/** Creation accepted: counts it, and triggers the shield beyond the threshold. */
export function accept(kind: AnonKind, anon: boolean): void {
  if (kind === "push") current("all:push").count++;
  if (!anon) return;
  const w = current(`anon:${kind}`);
  w.count++;
  const shield = kind === "push" ? g.shieldAnonPushesPerHour : g.shieldAnonBlobsPerHour;
  const now = Date.now();
  if (w.count >= shield && now >= shieldUntil) {
    shieldUntil = now + g.shieldMinutes * 60_000;
    // IPs exempted during a previous shield go through Turnstile again
    cleared.clear();
    alert("shield", "shield on", `${w.count} anonymous ${kind === "push" ? "links" : "files"} this hour: Turnstile required for ${g.shieldMinutes} min`);
  }
}

/** Current state, for the admin dashboard. */
export function guardStatus() {
  const now = Date.now();
  return {
    shieldActive: now < shieldUntil,
    shieldUntil: now < shieldUntil ? new Date(shieldUntil).toISOString() : null,
    turnstile: !!config.turnstileSecret,
    anonPushesThisHour: current("anon:push").count,
    anonBlobsThisHour: current("anon:blob").count,
    allPushesThisHour: current("all:push").count,
    // thresholds without the alert URL (no point sending it to the browser)
    thresholds: { ...g, alertNtfyUrl: undefined },
    alerts: !!g.alertNtfyUrl,
    diskFreeMb: Math.round(diskFreeMb()),
  };
}
