import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { randomToken, sha256 } from "@/lib/tokens";

export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    const tokens = await prisma.apiToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    });
    return json({ tokens });
  } catch (err) {
    return handleError(err, req);
  }
}

const createSchema = z.object({ name: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const { name } = createSchema.parse(await req.json());
    const token = `ppush_${randomToken(43)}`;
    const created = await prisma.apiToken.create({
      data: { userId: user.id, name: name.trim(), tokenHash: sha256(token) },
    });
    // The plaintext token is shown only once
    return json({ id: created.id, name: created.name, token }, 201);
  } catch (err) {
    return handleError(err, req);
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const { id } = deleteSchema.parse(await req.json());
    await prisma.apiToken.deleteMany({ where: { id, userId: user.id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
