import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { config } from "@/lib/config";

const schema = z.object({
  defaultDays: z.number().int().min(1),
  defaultViews: z.number().int().min(1),
  defaultRetrievalStep: z.boolean(),
  defaultDeletableByViewer: z.boolean(),
});

export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const data = schema.parse(await req.json());
    if (data.defaultDays > config.limits.user.maxDays) {
      return apiError(t("defaultsMaxDays", { days: config.limits.user.maxDays }), 400);
    }
    if (data.defaultViews > config.limits.user.maxViews) {
      return apiError(t("defaultsMaxViews", { views: config.limits.user.maxViews }), 400);
    }

    await prisma.user.update({ where: { id: user.id }, data });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
