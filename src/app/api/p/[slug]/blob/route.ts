import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { expirePush } from "@/lib/pushes";
import { blobStream } from "@/lib/files";
import { consumeViewToken, clearPendingDelivery } from "@/lib/viewtokens";
import { rateLimit, clientIp } from "@/lib/ratelimit";

type Params = { params: Promise<{ slug: string }> };

/** Header carrying the single-use download token. */
export const VIEW_TOKEN_HEADER = "x-view-token";

/**
 * Download of a FILE push's encrypted blob. Requires a single-use viewToken
 * issued by /reveal (the view was already counted at that point).
 *
 * The token travels in a HEADER, never in the query string: URLs leak into
 * access logs, `Referer` and browser history, and a credential has no business
 * being there.
 *
 * The push is only purged, and the view only settled, once the stream has gone
 * out in full. A transfer cut short therefore leaves the reserved view pending,
 * and /reveal can hand out a fresh token without charging another one.
 */
export async function GET(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    const { slug } = await params;
    if (!rateLimit(`dl:${clientIp(req)}`, 60, 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }
    const token = req.headers.get(VIEW_TOKEN_HEADER);
    if (!token || !consumeViewToken(slug, token)) {
      return apiError(t("viewTokenInvalid"), 403);
    }

    const push = await prisma.push.findUnique({ where: { slug } });
    if (!push || push.payloadDeleted || !push.blobPath) {
      return apiError(t("secretExpired"), 410);
    }

    const shouldExpire = push.views >= push.expireAfterViews;
    const nodeStream = blobStream(push.blobPath);
    const web = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    // `flush` only runs when the whole stream was read: this is what makes the
    // delivery (and the purge) conditional on the transfer actually finishing.
    const settleOnComplete = new TransformStream<Uint8Array, Uint8Array>({
      flush: async () => {
        clearPendingDelivery(slug);
        if (shouldExpire) {
          const fresh = await prisma.push.findUnique({ where: { id: push.id } });
          if (fresh && !fresh.payloadDeleted) await expirePush(fresh, "VIEWS");
        }
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    };
    // Only advertise a length we actually know — an empty Content-Length is an
    // invalid header value.
    if (typeof push.fileSize === "number") {
      headers["Content-Length"] = String(push.fileSize);
    }

    return new Response(web.pipeThrough(settleOnComplete), { headers });
  } catch (err) {
    return handleError(err, req);
  }
}
