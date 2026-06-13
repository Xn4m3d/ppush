/**
 * 2FA tickets: after a successful password login for an account with TOTP, an
 * ephemeral ticket (5 min) is issued; the session is only created once the
 * TOTP code is validated. In memory — single instance.
 */
import { randomToken, sha256, safeEqualHex } from "./tokens";

const TTL_MS = 5 * 60_000;
const tickets = new Map<string, { hash: string; userId: string; expiresAt: number; tries: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.expiresAt <= now) tickets.delete(k);
}, 60_000).unref?.();

export function issueTotpTicket(userId: string): string {
  const token = randomToken(32);
  tickets.set(sha256(token).slice(0, 24), {
    hash: sha256(token),
    userId,
    expiresAt: Date.now() + TTL_MS,
    tries: 0,
  });
  return token;
}

/** Returns the userId if the ticket is valid (without consuming it). ≤5 tries. */
export function checkTotpTicket(token: string): string | null {
  const entry = tickets.get(sha256(token).slice(0, 24));
  if (!entry || entry.expiresAt <= Date.now()) return null;
  if (!safeEqualHex(entry.hash, sha256(token))) return null;
  entry.tries++;
  if (entry.tries > 5) {
    tickets.delete(sha256(token).slice(0, 24));
    return null;
  }
  return entry.userId;
}

export function consumeTotpTicket(token: string): void {
  tickets.delete(sha256(token).slice(0, 24));
}
