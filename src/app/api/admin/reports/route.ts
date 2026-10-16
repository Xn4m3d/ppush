import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError, readJson } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { clientIp } from "@/lib/ratelimit";
import { adminLog } from "@/lib/admin-audit";
import { guardStatus } from "@/lib/guard";

const PER_PAGE = 20;

/**
 * Abuse reports, grouped by link (several visitors may report
 * the same one), with the targeted link's state and the anti-spam safeguards' state.
 */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const status = url.searchParams.get("status");
    const where =
      status === "handled" ? { status: "HANDLED" }
      : status === "dismissed" ? { status: "DISMISSED" }
      : status === "all" ? {}
      : { status: "PENDING" };

    const [total, pending, rows] = await Promise.all([
      prisma.abuseReport.count({ where }),
      prisma.abuseReport.count({ where: { status: "PENDING" } }),
      prisma.abuseReport.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    ]);

    const pushIds = [...new Set(rows.map((r) => r.pushId).filter((v): v is string => !!v))];
    const pushes = pushIds.length
      ? await prisma.push.findMany({
          where: { id: { in: pushIds } },
          select: { id: true, kind: true, userId: true, payloadDeleted: true, createdAt: true, expiresAt: true, source: true },
        })
      : [];
    const byId = new Map(pushes.map((p) => [p.id, p]));
    const counts = await prisma.abuseReport.groupBy({ by: ["slug"], where: { slug: { in: rows.map((r) => r.slug) } }, _count: true });
    const countBySlug = new Map(counts.map((c) => [c.slug, c._count]));

    const reports = rows.map((r) => {
      const p = r.pushId ? byId.get(r.pushId) : undefined;
      return {
        id: r.id,
        slug: r.slug,
        reason: r.reason,
        comment: r.comment,
        ip: r.ip,
        status: r.status,
        createdAt: r.createdAt,
        handledAt: r.handledAt,
        handledBy: r.handledBy,
        reportsOnLink: countBySlug.get(r.slug) ?? 1,
        push: p
          ? { id: p.id, kind: p.kind, anon: p.userId === null, gone: p.payloadDeleted, createdAt: p.createdAt, expiresAt: p.expiresAt, source: p.source }
          : null,
      };
    });

    return json({ reports, total, pending, page, perPage: PER_PAGE, guard: guardStatus() });
  } catch (err) {
    return handleError(err, req);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["HANDLED", "DISMISSED", "PENDING"]),
});

/** Files a report (taking the link down goes through DELETE /api/admin/pushes). Logged. */
export async function PATCH(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);
    const { id, status } = patchSchema.parse(await readJson(req, 4_096));
    const report = await prisma.abuseReport.findUnique({ where: { id } });
    if (!report) return apiError(t("reportNotFound"), 404);
    // all PENDING reports on the same link follow the decision
    await prisma.abuseReport.updateMany({
      where: { slug: report.slug, status: report.status },
      data: status === "PENDING"
        ? { status, handledAt: null, handledBy: null }
        : { status, handledAt: new Date(), handledBy: user.email },
    });
    await adminLog(user, "REPORT_STATUS", { type: "PUSH", id: report.pushId ?? report.slug, label: report.slug }, {
      ip: clientIp(req),
      details: { status, reason: report.reason },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
