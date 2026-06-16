import { prisma } from "./db";
import { randomToken, sha256 } from "./tokens";

/**
 * Single-use password reset, initiated by an admin (there is no recovery email).
 * The clear-text token is returned only once, to be delivered through a ppush
 * push (E2E-encrypted); in the database we keep only its SHA-256 hash,
 * single-use and short-lived.
 */
const RESET_TTL_MS = 60 * 60_000; // 1 h

export async function createPasswordReset(
  userId: string,
  adminId: string
): Promise<string> {
  const token = randomToken(43); // ~256 bits
  await prisma.$transaction([
    // a single active reset at a time per account
    prisma.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordReset.create({
      data: {
        userId,
        tokenHash: sha256(token),
        createdById: adminId,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** Valid token (unused, not expired) → the row; otherwise null. */
export async function findValidReset(token: string) {
  if (!token) return null;
  const r = await prisma.passwordReset.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!r || r.usedAt || r.expiresAt < new Date()) return null;
  return r;
}
