import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { expirePush, ownerPushView, withLazyExpiry, audit } from "@/lib/pushes";
import { clientIp } from "@/lib/ratelimit";
import { maskIp } from "@/lib/ip";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    const user = await requireUser(req);
    if (!user) return apiError(t("authRequired"), 401);
    const { slug } = await params;

    const push = await prisma.push.findUnique({
      where: { slug },
      include: { events: { orderBy: { createdAt: "desc" }, take: 200 } },
    });
    if (!push || (push.userId !== user.id && user.role !== "ADMIN")) {
      return apiError(t("pushNotFound"), 404);
    }

    const fresh = await withLazyExpiry(push);
    return json({
      ...ownerPushView(fresh),
      events: push.events.map((e) => ({
        kind: e.kind,
        // A recipient's IP = third-party data → masked /24 for the
        // creator (minimization). The admin keeps the full IP (legal basis).
        ip: user.role === "ADMIN" ? e.ip : maskIp(e.ip),
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err, req);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await requireUser(req);
    if (!user) return apiError(t("authRequired"), 401);
    const { slug } = await params;

    const push = await prisma.push.findUnique({ where: { slug } });
    if (!push || (push.userId !== user.id && user.role !== "ADMIN")) {
      return apiError(t("pushNotFound"), 404);
    }
    if (!push.payloadDeleted) {
      await expirePush(push, "OWNER");
      await audit(push.id, "OWNER_DELETE", {
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
