import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { audit, isExpired, withLazyExpiry, expirePush } from "@/lib/pushes";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueViewToken } from "@/lib/viewtokens";
import { bumpDailyStat } from "@/lib/stats";

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({ passphrase: z.string().max(256).optional() });

/**
 * Reveals the encrypted payload: checks the optional passphrase, counts a view,
 * logs it, and returns the ciphertext (which only the key holder — in the URL
 * fragment — can decrypt).
 */
export async function POST(req: Request, { params }: Params) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const { slug } = await params;
    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent") ?? undefined;

    if (!rateLimit(`reveal:${ip}`, 60, 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }

    const found = await prisma.push.findUnique({ where: { slug } });
    if (!found) return apiError(t("linkNotFound"), 404);
    const push = await withLazyExpiry(found);
    if (isExpired(push) || !push.ciphertext) {
      return apiError(t("secretExpired"), 410);
    }

    if (push.passphraseHash) {
      if (!rateLimit(`passphrase:${slug}:${ip}`, 5, 10 * 60_000)) {
        return apiError(t("passphraseTooMany"), 429);
      }
      const { passphrase } = schema.parse(await req.json().catch(() => ({})));
      if (!passphrase || !(await verifyPassword(push.passphraseHash, passphrase))) {
        await audit(push.id, "FAILED_PASSPHRASE", { ip, userAgent });
        return apiError(t("wrongPassphrase"), 401);
      }
    }

    // ATOMIC reservation of a view (anti-race): the conditional UPDATE
    // only increments if the quota isn't already reached. Two concurrent
    // reveals on a "1 view" secret therefore cannot both serve the clear text
    // — only one reserves the view, the other gets 410.
    const claim = await prisma.push.updateMany({
      where: {
        id: push.id,
        payloadDeleted: false,
        expiresAt: { gt: new Date() },
        views: { lt: push.expireAfterViews },
      },
      data: { views: { increment: 1 } },
    });
    if (claim.count === 0) return apiError(t("secretExpired"), 410);
    await audit(push.id, "VIEW", { ip, userAgent });
    await bumpDailyStat("views");

    const response = {
      kind: push.kind,
      ciphertext: Buffer.from(push.ciphertext).toString("base64"),
      deletableByViewer: push.deletableByViewer,
      viewToken: push.kind === "FILE" ? issueViewToken(slug) : undefined,
    };

    // Quota reached → immediate purge AFTER reading the ciphertext (not for FILE:
    // the blob is purged at the end of the download, and since the view was just
    // reserved, we don't issue more tokens than remaining views).
    const updated = await prisma.push.findUnique({ where: { id: push.id } });
    if (updated && updated.views >= updated.expireAfterViews && push.kind !== "FILE") {
      await expirePush(updated, "VIEWS");
    }

    return json(response);
  } catch (err) {
    return handleError(err, req);
  }
}
