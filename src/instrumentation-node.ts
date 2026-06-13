/**
 * Background tasks (Node runtime only):
 *  - sweep expired pushes (purge payloads)
 *  - clean up expired sessions and orphan blobs
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { sweepExpired } from "@/lib/pushes";
import { prisma } from "@/lib/db";
import { blobDir, config } from "@/lib/config";

export async function startBackgroundTasks() {
  const sweep = async () => {
    try {
      await sweepExpired();
      await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      // GDPR retention: anonymize audit-log IP/UA beyond the stated duration
      // (keeps the event, removes the personal data).
      const cutoff = new Date(Date.now() - config.dataRetentionDays * 86_400_000);
      await prisma.auditEvent.updateMany({
        where: {
          createdAt: { lt: cutoff },
          OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
        },
        data: { ip: null, userAgent: null },
      });

      // Permanently purge ownerless shells outside the legal window (expired
      // anonymous pushes or ones detached from a deleted account). At this
      // point their audit IP was just anonymized above → no personal data and
      // no retention obligation left: we delete them.
      // Pushes still attached to an account (non-null userId) are preserved
      // (owner history); only their IPs > 12 months are anonymized.
      await prisma.auditEvent.deleteMany({
        where: { push: { userId: null, createdAt: { lt: cutoff } } },
      });
      await prisma.push.deleteMany({
        where: { userId: null, createdAt: { lt: cutoff } },
      });

      // orphan blobs: files > 6h never referenced by a push
      const entries = await fsp.readdir(blobDir()).catch(() => [] as string[]);
      for (const entry of entries) {
        const abs = path.join(blobDir(), entry);
        const st = await fsp.stat(abs).catch(() => null);
        if (!st || Date.now() - st.mtimeMs < 6 * 3_600_000) continue;
        const referenced = await prisma.push.findFirst({
          where: { blobPath: entry },
        });
        if (!referenced) await fsp.unlink(abs).catch(() => {});
      }
    } catch (err) {
      console.error("[sweep]", err);
    }
  };

  await sweep();
  setInterval(sweep, 10 * 60_000).unref?.();
}
