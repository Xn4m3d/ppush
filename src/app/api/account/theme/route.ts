import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";

const schema = z.object({ theme: z.enum(["auto", "midnight", "mecha"]) });

/** Theme preference of a signed-in user (persisted, follows devices). */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    const { theme } = schema.parse(await req.json());
    await prisma.user.update({ where: { id: user.id }, data: { theme } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
