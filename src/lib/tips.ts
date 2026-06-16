import { prisma } from "./db";
import type { Locale } from "@/i18n/locale";
import en from "@/../messages/en.json";
import fr from "@/../messages/fr.json";

/**
 * Security tips shown on the site, managed in the database (editable from the
 * admin) and SEEDED on first access from the bundled defaults (messages/*.json →
 * tips.list, two parallel en/fr arrays). Server-only (imports Prisma + the JSON
 * catalog): never import client-side.
 */
const DEFAULTS: { en: string; fr: string }[] = (() => {
  const e = en.tips.list as string[];
  const f = fr.tips.list as string[];
  const n = Math.min(e.length, f.length);
  return Array.from({ length: n }, (_, i) => ({ en: e[i], fr: f[i] }));
})();

/** Seeds the table from the defaults if it's empty (idempotent). */
export async function seedTipsIfEmpty(): Promise<void> {
  const count = await prisma.tip.count();
  if (count > 0) return;
  await prisma.tip.createMany({
    data: DEFAULTS.map((d, i) => ({ en: d.en, fr: d.fr, sortOrder: i, active: true })),
  });
}

/** Active tips, in order, for the given locale (fallback: defaults). */
export async function getActiveTips(locale: Locale): Promise<string[]> {
  await seedTipsIfEmpty();
  const rows = await prisma.tip.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { en: true, fr: true },
  });
  const tips = rows.map((r) => (locale === "fr" ? r.fr : r.en)).filter(Boolean);
  if (tips.length === 0) return DEFAULTS.map((d) => (locale === "fr" ? d.fr : d.en));
  return tips;
}

/** All tips (admin), in order. */
export async function listAllTips() {
  await seedTipsIfEmpty();
  return prisma.tip.findMany({ orderBy: { sortOrder: "asc" } });
}
