import { z } from "zod";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { clientIp } from "@/lib/ratelimit";
import { expirePush, isExpired } from "@/lib/pushes";
import { adminLog } from "@/lib/admin-audit";
import type { Push } from "@/generated/prisma/client";

const PER_PAGE = 20;

/** Admin view of a push: METADATA only, never the content (E2E). */
function adminPushRow(
  push: Push & { user?: { email: string } | null; _count?: { events: number } }
) {
  return {
    id: push.id,
    slug: push.slug,
    kind: push.kind,
    url: `${config.baseUrl}/p/${push.slug}`,
    ownerEmail: push.user?.email ?? null, // null = anonyme
    anon: push.userId === null,
    views: push.views,
    expireAfterViews: push.expireAfterViews,
    fileSize: push.fileSize,
    hasPassphrase: !!push.passphraseHash,
    createdAt: push.createdAt,
    expiresAt: push.expiresAt,
    expired: isExpired(push),
    expiredAt: push.expiredAt,
    expireReason: push.expireReason,
    events: push._count?.events ?? 0,
  };
}

export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const owner = url.searchParams.get("owner"); // anon | account
    const kind = url.searchParams.get("kind"); // PASSWORD | TEXT | FILE | URL
    const status = url.searchParams.get("status"); // active | expired | file
    const now = new Date();

    const where = {
      ...(q ? { OR: [{ slug: { contains: q } }, { id: q }] } : {}),
      ...(owner === "anon" ? { userId: null } : owner === "account" ? { userId: { not: null } } : {}),
      ...(kind && ["PASSWORD", "TEXT", "FILE", "URL"].includes(kind) ? { kind } : {}),
      ...(status === "active"
        ? { payloadDeleted: false, expiresAt: { gt: now } }
        : status === "expired"
          ? { OR: [{ payloadDeleted: true }, { expiresAt: { lte: now } }] }
          : status === "file"
            ? { kind: "FILE" }
            : {}),
    };

    const [total, pushes] = await Promise.all([
      prisma.push.count({ where }),
      prisma.push.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
        include: { user: { select: { email: true } }, _count: { select: { events: true } } },
      }),
    ]);

    return json({ pushes: pushes.map(adminPushRow), total, page, perPage: PER_PAGE });
  } catch (err) {
    return handleError(err, req);
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * Admin takedown: purges the payload (content) IMMEDIATELY, keeps the audit
 * log (creation IP) under the hosting-provider retention obligation. Covers
 * abuse / illegal content / GDPR content erasure.
 */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = deleteSchema.parse(await req.json());
    const push = await prisma.push.findUnique({ where: { id } });
    if (!push) return apiError(t("pushNotFound"), 404);

    if (!push.payloadDeleted) await expirePush(push, "ADMIN");
    await adminLog(user, "PUSH_TAKEDOWN", { type: "PUSH", id: push.id, label: push.slug }, {
      ip: clientIp(req),
      details: { kind: push.kind, anon: push.userId === null },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
