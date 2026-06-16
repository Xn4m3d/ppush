import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { geoLookup, geoAvailable } from "@/lib/geo";
import { dayKey } from "@/lib/stats";

type Gran = "day" | "week" | "month";

function mondayKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // recule au lundi
  return dayKey(x);
}
function bucketKeyFor(dateStr: string, gran: Gran): string {
  if (gran === "day") return dateStr;
  const d = new Date(dateStr + "T00:00:00Z");
  return gran === "week" ? mondayKey(d) : `${dateStr.slice(0, 7)}-01`;
}
function* bucketStarts(startStr: string, gran: Gran): Generator<string> {
  const cur = new Date(bucketKeyFor(startStr, gran) + "T00:00:00Z");
  const end = new Date();
  while (cur <= end) {
    yield dayKey(cur);
    if (gran === "day") cur.setUTCDate(cur.getUTCDate() + 1);
    else if (gran === "week") cur.setUTCDate(cur.getUTCDate() + 7);
    else cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
}

/** Visual dashboard data: time series (range + adaptive granularity, from the
 *  DailyStat aggregates) + geo (admin). */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const params = new URL(req.url).searchParams;
    const range = params.get("range") ?? "30"; // 7|30|90|365|all (time series)
    const geoMode = params.get("mode") ?? "activity"; // activity | creations (carte)

    let startKey: string;
    let spanDays: number;
    if (range === "all") {
      const first = await prisma.dailyStat.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
      startKey = first?.date ?? dayKey();
      spanDays = (Date.now() - new Date(startKey + "T00:00:00Z").getTime()) / 86_400_000;
    } else {
      spanDays = parseInt(range, 10) || 30;
      startKey = dayKey(new Date(Date.now() - (spanDays - 1) * 86_400_000));
    }
    const gran: Gran = spanDays > 365 ? "month" : spanDays > 92 ? "week" : "day";

    const rows = await prisma.dailyStat.findMany({ where: { date: { gte: startKey } }, orderBy: { date: "asc" } });
    const buckets = new Map<string, { date: string; pushes: number; views: number; signups: number }>();
    for (const k of bucketStarts(startKey, gran)) buckets.set(k, { date: k, pushes: 0, views: 0, signups: 0 });
    for (const r of rows) {
      const b = buckets.get(bucketKeyFor(r.date, gran));
      if (b) {
        b.pushes += r.pushes;
        b.views += r.views;
        b.signups += r.signups;
      }
    }

    // --- geo: map of the LAST 30 DAYS (beyond that = unreadable) ---
    // mode "activity" = acted (created/revealed a secret) + sessions;
    // mode "creations" = creations only (strongest anti-bot signal: creating a
    // secret is a deliberate, rate-limited action, not a passive view).
    const geoSince = new Date(Date.now() - 30 * 86_400_000);
    const geoKinds = geoMode === "creations" ? ["CREATED"] : ["CREATED", "VIEW"];
    const evtRows = await prisma.auditEvent.groupBy({
      by: ["ip"],
      where: { ip: { not: null }, kind: { in: geoKinds }, createdAt: { gte: geoSince } },
      _count: { ip: true },
      orderBy: { _count: { ip: "desc" } },
      take: 4000,
    });
    const sesRows =
      geoMode === "creations"
        ? []
        : await prisma.session.groupBy({
            by: ["ip"],
            where: { ip: { not: null }, createdAt: { gte: geoSince } },
            _count: { ip: true },
            orderBy: { _count: { ip: "desc" } },
            take: 2000,
          });

    const ipCounts = new Map<string, number>();
    for (const r of evtRows) if (r.ip) ipCounts.set(r.ip, (ipCounts.get(r.ip) ?? 0) + r._count.ip);
    for (const r of sesRows) if (r.ip) ipCounts.set(r.ip, (ipCounts.get(r.ip) ?? 0) + r._count.ip);

    const countries = new Map<string, { code: string; name: string; count: number }>();
    const cities = new Map<string, { city: string | null; country: string; lat: number; lon: number; count: number }>();
    let located = 0;
    let unlocated = 0;
    for (const [ip, count] of ipCounts) {
      const g = await geoLookup(ip);
      if (!g) {
        unlocated += count;
        continue;
      }
      located += count;
      const c = countries.get(g.country) ?? { code: g.country, name: g.countryName, count: 0 };
      c.count += count;
      countries.set(g.country, c);
      if (g.lat != null && g.lon != null) {
        const key = `${g.country}|${g.city}|${g.lat.toFixed(1)},${g.lon.toFixed(1)}`;
        const ci = cities.get(key) ?? { city: g.city, country: g.country, lat: g.lat, lon: g.lon, count: 0 };
        ci.count += count;
        cities.set(key, ci);
      }
    }

    return json({
      timeseries: [...buckets.values()],
      granularity: gran,
      geo: {
        available: await geoAvailable(),
        mode: geoMode,
        countries: [...countries.values()].sort((a, b) => b.count - a.count),
        cities: [...cities.values()].sort((a, b) => b.count - a.count).slice(0, 300),
        located,
        unlocated,
      },
    });
  } catch (err) {
    return handleError(err, req);
  }
}
