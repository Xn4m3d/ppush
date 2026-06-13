import { destroySession } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";

export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    await destroySession();
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
