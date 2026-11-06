/**
 * Strength of a TYPED password, page side. The estimate (zxcvbn, see
 * `strength-measure.ts`) costs from a few tens of ms to more than a second
 * per keystroke: it runs in a worker, never on the page's thread, so that
 * typing and the cloud stay smooth. The worker (and its dictionaries,
 * ~2 MB) only loads on the first keystroke.
 *
 * One estimate at a time: while it runs, only the LATEST requested value
 * waits for its turn; the ones it replaces resolve to `null`. Results thus
 * arrive in request order, with no queue growing when typing fast. Without
 * a worker (creation refused, script not found), the same rule applies to a
 * computation on the page.
 */

type Job = { pw: string; id: number; done: (bits: number | null) => void };

/** undefined: not created yet; null: unavailable, computed on the page */
let worker: Worker | null | undefined;
let running: Job | null = null;
let waiting: Job | null = null;
let ids = 0;
let local: Promise<(pw: string) => number> | null = null;

function settle(id: number, bits: number | null) {
  if (!running || running.id !== id) return;
  const job = running;
  running = null;
  job.done(bits);
  pump();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL("./strength.worker.ts", import.meta.url), { type: "module" });
    w.addEventListener("message", (e: MessageEvent<{ id: number; bits: number | null }>) => settle(e.data.id, e.data.bits));
    // script refused or not found: switch to the page, the current request is resumed there
    w.addEventListener("error", () => {
      w.terminate();
      worker = null;
      const job = running;
      running = null;
      if (job) { if (waiting) job.done(null); else waiting = job; }
      pump();
    });
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

function pump() {
  if (running || !waiting) return;
  const job = (running = waiting);
  waiting = null;
  const w = getWorker();
  if (w) { w.postMessage({ id: job.id, pw: job.pw }); return; }
  // on the page: after the current keystroke has rendered
  setTimeout(() => {
    local ??= import("./strength-measure").then((m) => m.createMeasure());
    // a loading failure (network) must not block later attempts
    local.catch(() => { local = null; });
    local.then((measure) => settle(job.id, measure(job.pw))).catch(() => settle(job.id, null));
  }, 0);
}

/** Estimated bits of `pw` (log2 of the number of guesses); `null` if a newer request replaced it or the estimate failed. */
export function estimateStrength(pw: string): Promise<number | null> {
  return new Promise((done) => {
    waiting?.done(null);
    waiting = { pw, id: ++ids, done };
    pump();
  });
}

export type StrengthLevel = "weak" | "fair" | "good" | "strong";

/**
 * Levels aligned with the entropy table: below 40 bits, falls within
 * minutes against one graphics card; 60 bits = common benchmark;
 * 80 bits = CNIL threshold for a password used on its own.
 */
export function strengthLevel(bits: number): StrengthLevel {
  if (bits < 40) return "weak";
  if (bits < 60) return "fair";
  if (bits < 80) return "good";
  return "strong";
}
