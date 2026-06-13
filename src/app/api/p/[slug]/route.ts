import { prisma } from "@/lib/db";
import { json, apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { publicPushView, withLazyExpiry } from "@/lib/pushes";
import { rateLimit, clientIp } from "@/lib/ratelimit";

type Params = { params: Promise<{ slug: string }> };

/** Public metadata of a push (no sensitive data). */
export async function GET(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    // Wide (legitimate viewing) but blocks slug-enumeration scanning.
    if (!rateLimit(`meta:${clientIp(req)}`, 120, 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }
    const { slug } = await params;
    const push = await prisma.push.findUnique({ where: { slug } });
    if (!push) return apiError(t("linkNotFound"), 404);
    const fresh = await withLazyExpiry(push);
    return json(publicPushView(fresh));
  } catch (err) {
    return handleError(err, req);
  }
}
