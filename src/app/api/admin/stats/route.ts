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
      files,
      storage,
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
      prisma.push.count({ where: { kind: "FILE", payloadDeleted: false } }),
      storageStatus(),
    ]);

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
      pushes: { total: pushesTotal, active: pushesActive, expired: pushesTotal - pushesActive, files },
      storage: { usedBytes: storage.usedBytes, availableBytes: storage.availableBytes },
    });
  } catch (err) {
    return handleError(err, req);
  }
}
