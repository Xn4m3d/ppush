import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";

// "Note to send with the link", customizable per push type. Empty →
// null (= falls back to the default text). Account-only.
const field = z.string().trim().max(500).optional();
const schema = z.object({
  password: field,
  text: field,
  file: field,
  url: field,
});

export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const b = schema.parse(await req.json());
    await prisma.user.update({
      where: { id: user.id },
      data: {
        shareMsgPassword: b.password || null,
        shareMsgText: b.text || null,
        shareMsgFile: b.file || null,
        shareMsgUrl: b.url || null,
      },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
