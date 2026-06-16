import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth";
import { json, apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { isExpired } from "@/lib/pushes";

/** Push details for the admin: metadata + audit log (IP/UA of
 *  views). Never the content (E2E-encrypted, unreadable server-side). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = await params;
    const push = await prisma.push.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!push) return apiError(t("pushNotFound"), 404);

    return json({
      push: {
        id: push.id,
        slug: push.slug,
        kind: push.kind,
        url: `${config.baseUrl}/p/${push.slug}`,
        owner: push.user ? { id: push.user.id, email: push.user.email } : null,
        anon: push.userId === null,
        views: push.views,
        expireAfterViews: push.expireAfterViews,
        expireAfterMinutes: push.expireAfterMinutes,
        retrievalStep: push.retrievalStep,
        deletableByViewer: push.deletableByViewer,
        hasPassphrase: !!push.passphraseHash,
        fileSize: push.fileSize,
        createdAt: push.createdAt,
        expiresAt: push.expiresAt,
        expired: isExpired(push),
        expiredAt: push.expiredAt,
        expireReason: push.expireReason,
      },
      events: push.events.map((e) => ({
        id: e.id,
        kind: e.kind,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err, req);
  }
}
