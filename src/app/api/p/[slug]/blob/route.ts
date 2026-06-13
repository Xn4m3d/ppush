import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { expirePush } from "@/lib/pushes";
import { blobStream } from "@/lib/files";
import { consumeViewToken } from "@/lib/viewtokens";
import { rateLimit, clientIp } from "@/lib/ratelimit";

type Params = { params: Promise<{ slug: string }> };

/**
 * Download of a FILE push's encrypted blob. Requires a single-use viewToken
 * issued by /reveal (the view was already counted at that point).
 * If it was the last view, the push is purged once the stream finishes.
 */
export async function GET(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    const { slug } = await params;
    if (!rateLimit(`dl:${clientIp(req)}`, 60, 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }
    const token = new URL(req.url).searchParams.get("vt");
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

    const expireAfter = new TransformStream<Uint8Array, Uint8Array>({
      flush: async () => {
        if (shouldExpire) {
          const fresh = await prisma.push.findUnique({ where: { id: push.id } });
          if (fresh && !fresh.payloadDeleted) await expirePush(fresh, "VIEWS");
        }
      },
    });

    return new Response(web.pipeThrough(expireAfter), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(push.fileSize ?? ""),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err, req);
  }
}
