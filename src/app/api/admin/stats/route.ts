import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { storageStatus } from "@/lib/storage";

/** Admin dashboard metrics (aggregates, no row loading). */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const now = new Date();
    const [
      usersTotal,
      usersActive,
      usersPending,
      usersDisabled,
      admins,
      with2fa,
      withPasskey,
      pushesTotal,
      pushesActive,
      pushesAnon,
      pushesAnonActive,
      files,
      views,
      storage,
      recoveryPending,
      pushesApiActive,
      sourceRows,
      topApiTokenRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { active: false, approvedAt: null } }),
      prisma.user.count({ where: { active: false, approvedAt: { not: null } } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { totpEnabledAt: { not: null } } }),
      prisma.user.count({ where: { credentials: { some: {} } } }),
      prisma.push.count(),
      prisma.push.count({ where: { payloadDeleted: false, expiresAt: { gt: now } } }),
      prisma.push.count({ where: { userId: null } }),
      prisma.push.count({ where: { userId: null, payloadDeleted: false, expiresAt: { gt: now } } }),
      prisma.push.count({ where: { kind: "FILE", payloadDeleted: false } }),
      prisma.auditEvent.count({ where: { kind: "VIEW" } }),
      storageStatus(),
      prisma.recoveryRequest.count({ where: { status: "PENDING" } }),
      prisma.push.count({
        where: { source: "API", payloadDeleted: false, expiresAt: { gt: now } },
      }),
      prisma.push.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.push.groupBy({
        by: ["apiTokenName"],
        where: { source: "API" },
        _count: { _all: true },
        orderBy: { _count: { apiTokenName: "desc" } },
        take: 5,
      }),
    ]);

    const srcCount = (s: string) =>
      sourceRows.find((r) => r.source === s)?._count._all ?? 0;

    return json({
      users: {
        total: usersTotal,
        active: usersActive,
        pending: usersPending,
        disabled: usersDisabled,
        admins,
        with2fa,
        withPasskey,
      },
      pushes: {
        total: pushesTotal,
        active: pushesActive,
        expired: pushesTotal - pushesActive,
        files,
        anon: pushesAnon,
        anonActive: pushesAnonActive,
        views,
        bySource: {
          web: srcCount("WEB"),
          api: srcCount("API"),
          anon: srcCount("ANON"),
        },
        apiActive: pushesApiActive,
        topApiTokens: topApiTokenRows.map((r) => ({
          name: r.apiTokenName ?? "",
          count: r._count._all,
        })),
      },
      storage: { usedBytes: storage.usedBytes, availableBytes: storage.availableBytes },
      recovery: { pending: recoveryPending },
    });
  } catch (err) {
    return handleError(err, req);
  }
}
