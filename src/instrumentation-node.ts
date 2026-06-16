/**
 * Background tasks (Node runtime only):
 *  - sweep of expired pushes (payload purge)
 *  - cleanup of expired sessions and orphan blobs
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { sweepExpired } from "@/lib/pushes";
import { prisma } from "@/lib/db";
import { blobDir, config } from "@/lib/config";
import { releaseGeoIfIdle } from "@/lib/geo";
import { backfillDailyStats } from "@/lib/stats";

export async function startBackgroundTasks() {
  const sweep = async () => {
    try {
      releaseGeoIfIdle(); // release the geo database (~125 MB) if idle
      await sweepExpired();
      await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      // GDPR retention: anonymize the audit log's IPs/UAs beyond the
      // announced period (keeps the event, removes personal data).
      const cutoff = new Date(Date.now() - config.dataRetentionDays * 86_400_000);
      await prisma.auditEvent.updateMany({
        where: {
          createdAt: { lt: cutoff },
          OR: [{ ip: { not: null } }, { userAgent: { not: null } }],
        },
        data: { ip: null, userAgent: null },
      });
      // Same for the admin action log (same connection data).
      await prisma.adminAudit.updateMany({
        where: { createdAt: { lt: cutoff }, ip: { not: null } },
        data: { ip: null },
      });

      // Permanent purge of ownerless shells outside the legal window
      // (expired anonymous pushes or detached from a deleted account). At this point
      // their log's IP was just anonymized above → no personal data or
      // retention obligation left: we erase them.
      // Pushes still attached to an account (non-null userId) are preserved
      // (owner history); only their IPs older than 12 months are anonymized.
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

  await backfillDailyStats().catch(() => {}); // historique initial (idempotent)
  await sweep();
  setInterval(sweep, 10 * 60_000).unref?.();
}
