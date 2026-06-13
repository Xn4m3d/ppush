import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { config } from "./config";
import { randomToken } from "./tokens";

/** Relying Party = the service domain (ppush.online; localhost in dev). */
const u = new URL(config.baseUrl);
export const rpID = u.hostname;
export const rpName = "ppush";
export const expectedOrigin = u.origin;

const TTL_MS = 5 * 60_000;

// Ephemeral challenges (adding a passkey on an account + login), in memory.
const challenges = new Map<string, { challenge: string; expiresAt: number }>();
// Passwordless signups awaiting confirmation by the passkey.
type Signup = { email: string; name: string; userId: string; challenge: string; expiresAt: number };
const signups = new Map<string, Signup>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expiresAt <= now) challenges.delete(k);
  for (const [k, v] of signups) if (v.expiresAt <= now) signups.delete(k);
}, 60_000).unref?.();

export function putChallenge(key: string, challenge: string): void {
  challenges.set(key, { challenge, expiresAt: Date.now() + TTL_MS });
}
export function takeChallenge(key: string): string | null {
  const e = challenges.get(key);
  challenges.delete(key);
  return e && e.expiresAt > Date.now() ? e.challenge : null;
}
export function putSignup(flowId: string, s: Omit<Signup, "expiresAt">): void {
  signups.set(flowId, { ...s, expiresAt: Date.now() + TTL_MS });
}
export function takeSignup(flowId: string): Omit<Signup, "expiresAt"> | null {
  const e = signups.get(flowId);
  signups.delete(flowId);
  return e && e.expiresAt > Date.now() ? e : null;
}
export function newFlowId(): string {
  return randomToken(24);
}

export {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};
