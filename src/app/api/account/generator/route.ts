import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT, requestLocale } from "@/lib/i18n-api";
import { sanitizeGenPrefs } from "@/lib/generator-prefs";

/**
 * Per-account default generator settings. The body is sanitized
 * field by field (bounds, allowed values): arbitrary JSON is never
 * stored. No sensitive data: display preferences only.
 */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    const prefs = sanitizeGenPrefs(await req.json(), requestLocale(req));
    await prisma.user.update({ where: { id: user.id }, data: { generatorPrefs: JSON.stringify(prefs) } });
    return json({ ok: true, prefs });
  } catch (err) {
    return handleError(err, req);
  }
}

/** Back to the standard setting. */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    await prisma.user.update({ where: { id: user.id }, data: { generatorPrefs: null } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
