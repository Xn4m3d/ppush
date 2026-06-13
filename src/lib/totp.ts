/**
 * TOTP (RFC 6238) — minimal server-side implementation, no dependency.
 * SHA-1, 6 digits, 30 s step (compatible with Google Authenticator, Authy,
 * Bitwarden, 2FAS, etc.).
 */
import crypto from "node:crypto";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20); // 160 bits, standard size
  return base32Encode(bytes);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", secret).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_STEP_SECONDS);
}

/**
 * Verifies a code with a ±1 step window (clock drift).
 * Returns the accepted time step (for anti-replay) or null.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  lastAcceptedStep: number | null,
  now = Date.now()
): number | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const secret = base32Decode(secretB32);
  const step = currentStep(now);
  for (const candidate of [step, step - 1, step + 1]) {
    // anti-replay: reject any code from an already-consumed step
    if (lastAcceptedStep !== null && candidate <= lastAcceptedStep) continue;
    const expected = hotp(secret, candidate);
    if (
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))
    ) {
      return candidate;
    }
  }
  return null;
}

export function otpauthUri(secretB32: string, email: string): string {
  const issuer = "ppush";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    email
  )}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}
