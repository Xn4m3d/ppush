/**
 * Ephemeral download tokens for files: issued by /reveal (after the optional
 * passphrase + view decrement), valid for a few minutes.
 * In memory — single instance.
 */
import { randomToken, sha256, safeEqualHex } from "./tokens";

const TTL_MS = 5 * 60_000;
const tokens = new Map<string, { hash: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokens) if (v.expiresAt <= now) tokens.delete(k);
}, 60_000).unref?.();

export function issueViewToken(slug: string): string {
  const token = randomToken(32);
  tokens.set(`${slug}:${sha256(token).slice(0, 16)}`, {
    hash: sha256(token),
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

export function consumeViewToken(slug: string, token: string): boolean {
  const key = `${slug}:${sha256(token).slice(0, 16)}`;
  const entry = tokens.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return false;
  if (!safeEqualHex(entry.hash, sha256(token))) return false;
  tokens.delete(key);
  return true;
}
