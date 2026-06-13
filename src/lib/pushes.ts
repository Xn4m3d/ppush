import { prisma } from "./db";
import { deleteBlob } from "./files";
import { config } from "./config";
import type { Push } from "@/generated/prisma/client";

export type ExpireReason = "VIEWS" | "TIME" | "OWNER" | "VIEWER";

/**
 * Expires a push: permanently purges the payload (ciphertext + blob),
 * keeps the metadata and the audit log.
 */
export async function expirePush(push: Push, reason: ExpireReason): Promise<void> {
  if (push.blobPath) await deleteBlob(push.blobPath);
  await prisma.push.update({
    where: { id: push.id },
    data: {
      ciphertext: null,
      blobPath: null,
      payloadDeleted: true,
      expiredAt: push.expiredAt ?? new Date(),
      expireReason: push.expireReason ?? reason,
    },
  });
  await prisma.auditEvent.create({
    data: { pushId: push.id, kind: "EXPIRED" },
  });
}

export function isExpired(push: Push): boolean {
  if (push.payloadDeleted || push.expiredAt) return true;
  if (push.expiresAt < new Date()) return true;
  if (push.views >= push.expireAfterViews) return true;
  return false;
}

/** Checks expiry on the fly and purges if needed. Returns the up-to-date push. */
export async function withLazyExpiry(push: Push): Promise<Push> {
  if (!push.payloadDeleted && isExpired(push)) {
    const reason: ExpireReason =
      push.views >= push.expireAfterViews ? "VIEWS" : "TIME";
    await expirePush(push, reason);
    return (await prisma.push.findUnique({ where: { id: push.id } }))!;
  }
  return push;
}

/** Periodic sweep: purges time-expired pushes. */
export async function sweepExpired(): Promise<number> {
  const stale = await prisma.push.findMany({
    where: { payloadDeleted: false, expiresAt: { lt: new Date() } },
    take: 200,
  });
  for (const p of stale) await expirePush(p, "TIME");
  return stale.length;
}

export async function audit(
  pushId: string,
  kind: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      pushId,
      kind,
      ip: config.logIps ? meta?.ip : null,
      userAgent: meta?.userAgent?.slice(0, 255),
    },
  });
}

/** Public representation of a push for the recipient (no sensitive metadata). */
export function publicPushView(push: Push) {
  const expired = isExpired(push);
  return {
    slug: push.slug,
    kind: push.kind,
    expired,
    retrievalStep: push.retrievalStep,
    deletableByViewer: push.deletableByViewer,
    hasPassphrase: !!push.passphraseHash,
    fileSize: expired ? null : push.fileSize,
    // for the recipient-side countdown (never any sensitive data)
    expiresAt: push.expiresAt,
  };
}

/** Representation for the owner (dashboard, API). */
export function ownerPushView(push: Push & { _count?: { events: number } }) {
  return {
    id: push.id,
    slug: push.slug,
    kind: push.kind,
    note: push.note,
    url: `${config.baseUrl}/p/${push.slug}`,
    views: push.views,
    expireAfterViews: push.expireAfterViews,
    expireAfterMinutes: push.expireAfterMinutes,
    retrievalStep: push.retrievalStep,
    deletableByViewer: push.deletableByViewer,
    hasPassphrase: !!push.passphraseHash,
    fileSize: push.fileSize,
    createdAt: push.createdAt,
    expiresAt: push.expiresAt,
    expired: isExpired(push),
    expiredAt: push.expiredAt,
    expireReason: push.expireReason,
  };
}
