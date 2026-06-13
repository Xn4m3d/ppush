import { prisma } from "@/lib/db";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { expirePush, audit } from "@/lib/pushes";
import { rateLimit, clientIp } from "@/lib/ratelimit";

type Params = { params: Promise<{ slug: string }> };

/** Recipient-side destruction of the secret (if allowed by the creator). */
export async function POST(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const { slug } = await params;
    const ip = clientIp(req);
    if (!rateLimit(`burn:${ip}`, 30, 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }

    const push = await prisma.push.findUnique({ where: { slug } });
    if (!push) return apiError(t("linkNotFound"), 404);
    if (!push.deletableByViewer) {
      return apiError(t("burnNotAllowed"), 403);
    }
    if (!push.payloadDeleted) {
      await expirePush(push, "VIEWER");
      await audit(push.id, "VIEWER_DELETE", {
        ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
