import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "./db";
import { config } from "./config";
import { randomToken, sha256 } from "./tokens";
import type { User } from "@/generated/prisma/client";

export const SESSION_COOKIE = "ppush_session";

// Argon2id parameters — OWASP 2025 recommendations (m=19MiB, t=2, p=1)
const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export async function verifyPassword(
  hashed: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

export function isAllowedEmail(email: string): boolean {
  if (config.allowedDomains.length === 0) return true; // public registration
  const domain = email.toLowerCase().split("@")[1];
  return !!domain && config.allowedDomains.includes(domain);
}

export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<string> {
  const token = randomToken(43); // ~256 bits
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + config.sessionDays * 86_400_000),
      ip: config.logIps ? meta.ip : null,
      userAgent: meta.userAgent?.slice(0, 255),
    },
  });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: config.sessionDays * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Current user via session cookie (or null). */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }
  return session.user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: sha256(token) } })
      .catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/** API authentication via Bearer token. */
export async function apiUser(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!apiToken || !apiToken.user.active) return null;
  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return apiToken.user;
}

/** Current user: web session OR API token. */
export async function requireUser(req?: Request): Promise<User | null> {
  const fromSession = await currentUser();
  if (fromSession) return fromSession;
  if (req) return apiUser(req);
  return null;
}

/**
 * PRIMARY administrator account = the very first account created (bootstrap).
 * It can never be deleted (neither by itself nor by another admin).
 */
export async function primaryAdminId(): Promise<string | null> {
  const first = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}
