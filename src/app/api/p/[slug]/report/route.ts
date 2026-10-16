import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, apiError, badOrigin, handleError, readJson } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { config } from "@/lib/config";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { alert } from "@/lib/alert";
import { REPORT_REASONS } from "@/lib/reports";

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  reason: z.enum(REPORT_REASONS),
  comment: z.string().trim().max(500).optional(),
});

/**
 * A visitor reporting a link. The content stays unreadable to us:
 * the report points at the link, the admin judges and takes it down if needed. No
 * automatic takedown — otherwise anyone could get legitimate links destroyed.
 */
export async function POST(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const { slug } = await params;
    const ip = clientIp(req);
    if (!rateLimit(`report:${ip}`, 5, 60 * 60_000) || !rateLimit("report:all", 100, 60 * 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }
    const { reason, comment } = schema.parse(await readJson(req, 8_192));

    const push = await prisma.push.findUnique({ where: { slug }, select: { id: true } });
    if (!push) return apiError(t("linkNotFound"), 404);

    // a given visitor reports a given link only once
    const dup = await prisma.abuseReport.findFirst({
      where: { slug, ip: config.logIps ? ip : null, status: "PENDING" },
      select: { id: true },
    });
    if (!dup) {
      await prisma.abuseReport.create({
        data: { slug, pushId: push.id, reason, comment: comment || null, ip: config.logIps ? ip : null },
      });
      alert("abuse-report", "abuse report", `${reason} reported on /p/${slug}`);
    }
    return json({ ok: true }, 201);
  } catch (err) {
    return handleError(err, req);
  }
}
