/**
 * Ephemeral download tokens for files: issued by /reveal (after the optional
 * passphrase + view decrement), valid for a few minutes.
 * In memory — single instance.
 *
 * Tokens stay STRICTLY SINGLE-USE: they are burned the moment a download
 * starts, and they travel in a header, never in the URL.
 *
 * Recovering from a dropped transfer is handled one layer up instead, by
 * PENDING DELIVERY: while a FILE push has a view reserved whose blob was never
 * delivered in full, /reveal may hand out a fresh token without charging
 * another view. A cut connection therefore no longer costs the recipient the
 * file, and no token ever becomes replayable.
 */
import { randomToken, sha256, safeEqualHex } from "./tokens";

const TTL_MS = 5 * 60_000;
/**
 * Retries allowed on one reserved view. Bounded on purpose: each redelivery
 * also re-serves the ciphertext, so an unbounded budget would let a party
 * holding the link keep a push alive and re-read it past its views quota.
 */
const MAX_REDELIVERIES = 3;

const tokens = new Map<string, { hash: string; expiresAt: number }>();
/** slug → a view already paid for whose blob was never delivered in full. */
const pendingDelivery = new Map<string, { deadline: number; retries: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokens) if (v.expiresAt <= now) tokens.delete(k);
  for (const [k, v] of pendingDelivery) if (v.deadline <= now) pendingDelivery.delete(k);
}, 60_000).unref?.();

function keyFor(slug: string, token: string): string {
  return `${slug}:${sha256(token).slice(0, 16)}`;
}

export function issueViewToken(slug: string): string {
  const token = randomToken(32);
  tokens.set(keyFor(slug, token), {
    hash: sha256(token),
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

/** Single-use: a valid token is invalidated by this very call. */
export function consumeViewToken(slug: string, token: string): boolean {
  const key = keyFor(slug, token);
  const entry = tokens.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return false;
  if (!safeEqualHex(entry.hash, sha256(token))) return false;
  tokens.delete(key);
  return true;
}

// --- pending delivery -------------------------------------------------------

/** A view was just reserved and its blob still owes delivery. */
export function markPendingDelivery(slug: string): void {
  const existing = pendingDelivery.get(slug);
  pendingDelivery.set(slug, {
    deadline: Date.now() + TTL_MS,
    retries: existing?.retries ?? 0,
  });
}

/**
 * True while that reserved view has not been delivered. Side-effect free — it
 * is read from `isExpired`, so it must not consume anything.
 */
export function hasPendingDelivery(slug: string): boolean {
  const entry = pendingDelivery.get(slug);
  if (entry === undefined) return false;
  if (entry.deadline <= Date.now()) {
    pendingDelivery.delete(slug);
    return false;
  }
  return true;
}

/**
 * Books one retry against the reserved view. Returns false once the budget is
 * spent, and drops the pending state so the push goes back to expiring the
 * ordinary way.
 */
export function consumeRedelivery(slug: string): boolean {
  const entry = pendingDelivery.get(slug);
  if (!entry || entry.deadline <= Date.now()) return false;
  if (entry.retries >= MAX_REDELIVERIES) {
    pendingDelivery.delete(slug);
    return false;
  }
  entry.retries++;
  entry.deadline = Date.now() + TTL_MS;
  return true;
}

/** The blob went out in full — the view is settled. */
export function clearPendingDelivery(slug: string): void {
  pendingDelivery.delete(slug);
}
