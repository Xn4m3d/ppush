import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // base58, no ambiguous characters

/** High-entropy URL-safe token (~5.86 bits/char). 22 chars ≈ 128 bits. */
export function randomToken(length = 22): string {
  const bytes = crypto.randomBytes(length * 2);
  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    // rejection sampling for a uniform distribution
    const b = bytes[i];
    if (b < ALPHABET.length * Math.floor(256 / ALPHABET.length)) {
      out += ALPHABET[b % ALPHABET.length];
    }
  }
  while (out.length < length) out += randomToken(1);
  return out;
}

/** SHA-256 hex hash — to store sessions/API tokens without exposing them on a DB leak. */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Comparaison en temps constant de deux hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
