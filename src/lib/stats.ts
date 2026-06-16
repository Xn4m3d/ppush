import { prisma } from "./db";

/**
 * Anonymous daily aggregates (counters only) — incremented on the fly to keep a
 * RELIABLE multi-year history despite the purge of raw data at ~12 months. No
 * personal data, GDPR-compliant.
 */
export type StatField = "pushes" | "pushesAnon" | "views" | "signups";

export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Best-effort increment (never blocks the calling flow). */
export async function bumpDailyStat(field: StatField, n = 1): Promise<void> {
  const date = dayKey();
  try {
    await prisma.dailyStat.upsert({
      where: { date },
      create: { date, [field]: n },
      update: { [field]: { increment: n } },
    });
  } catch {
    /* non-critical counter */
  }
}

/**
 * One-time backfill from the raw data still present (idempotent: does nothing if
 * the table is already populated). Lets us show the existing history as soon as
 * it's enabled; the rest is covered by the increments.
 */
export async function backfillDailyStats(): Promise<void> {
  if ((await prisma.dailyStat.count()) > 0) return;
  const [pushes, views, users] = await Promise.all([
    prisma.push.findMany({ select: { createdAt: true, userId: true } }),
    prisma.auditEvent.findMany({ where: { kind: "VIEW" }, select: { createdAt: true } }),
    prisma.user.findMany({ select: { createdAt: true } }),
  ]);

  const map = new Map<string, { pushes: number; pushesAnon: number; views: number; signups: number }>();
  const at = (d: Date) => {
    const k = dayKey(d);
    let v = map.get(k);
    if (!v) {
      v = { pushes: 0, pushesAnon: 0, views: 0, signups: 0 };
      map.set(k, v);
    }
    return v;
  };
  for (const p of pushes) {
    const v = at(p.createdAt);
    v.pushes++;
    if (p.userId === null) v.pushesAnon++;
  }
  for (const e of views) at(e.createdAt).views++;
  for (const u of users) at(u.createdAt).signups++;

  if (map.size === 0) return;
  await prisma.dailyStat
    .createMany({ data: [...map.entries()].map(([date, v]) => ({ date, ...v })) })
    .catch(() => {});
}
