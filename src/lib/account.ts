import { prisma } from "./db";
import { config } from "./config";
import { deleteBlob } from "./files";

/**
 * Account deletion reconciling TWO obligations:
 *
 * 1. Right to erasure (GDPR art. 17-1) — the user (or an admin) requests
 *    deletion: the profile and all content disappear immediately and
 *    permanently.
 * 2. Connection-log retention required of the host (FR LCEN art. 6, decree
 *    2011-219, 1-year term) — which GDPR art. 17-3-b specifically exempts from
 *    the right to erasure ("processing necessary for compliance with a legal
 *    obligation"). These logs therefore CANNOT be erased before their term.
 *
 * In practice:
 *  - Erased at once and irreversibly: email, name, passkeys, API tokens,
 *    sessions, and ALL content (ciphertexts in DB + blobs on disk, notes,
 *    passphrase hash).
 *  - Kept until the legal term (`config.dataRetentionDays`, ~12 months), then
 *    purged: a MINIMAL connection log (IP + timestamp) dissociated from the
 *    account. The sweeper (`instrumentation-node`) anonymizes IP/UA at term.
 */
export async function purgeAccount(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - config.dataRetentionDays * 86_400_000);

  // Encrypted content on disk goes immediately (including pushes whose
  // connection log we keep: we retain the trace, not the secret).
  const files = await prisma.push.findMany({
    where: { userId, blobPath: { not: null } },
    select: { blobPath: true },
  });
  for (const f of files) if (f.blobPath) await deleteBlob(f.blobPath);

  await prisma.$transaction([
    // Outside the legal window: the connection data is stale → full purge.
    prisma.auditEvent.deleteMany({ where: { push: { userId, createdAt: { lt: cutoff } } } }),
    prisma.push.deleteMany({ where: { userId, createdAt: { lt: cutoff } } }),

    // Within the legal window: dissociate from the account and clear the
    // payload, but KEEP the row + its audit log (creation IP/timestamp).
    // Must run BEFORE deleting the account (otherwise `onDelete: Cascade`).
    prisma.push.updateMany({
      where: { userId, createdAt: { gte: cutoff } },
      data: {
        userId: null,
        ciphertext: null,
        blobPath: null,
        note: null,
        passphraseHash: null,
        payloadDeleted: true,
        expiredAt: new Date(),
        expireReason: "OWNER",
      },
    }),

    // Profile & access means: erased immediately.
    prisma.credential.deleteMany({ where: { userId } }),
    prisma.apiToken.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);
}
