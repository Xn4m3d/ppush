import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";

const PER_PAGE = 30;

/** Administration action log (most recent first). */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const [total, entries] = await Promise.all([
      prisma.adminAudit.count(),
      prisma.adminAudit.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
    ]);

    return json({
      entries: entries.map((e) => ({
        id: e.id,
        actorEmail: e.actorEmail,
        action: e.action,
        targetType: e.targetType,
        targetLabel: e.targetLabel,
        details: e.details,
        ip: e.ip,
        createdAt: e.createdAt,
      })),
      total,
      page,
      perPage: PER_PAGE,
    });
  } catch (err) {
    return handleError(err, req);
  }
}
