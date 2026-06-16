import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { listAllTips } from "@/lib/tips";

/** Lists all tips (seeds the defaults on first access). */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);
    return json({ tips: await listAllTips() });
  } catch (err) {
    return handleError(err, req);
  }
}

const createSchema = z.object({
  en: z.string().trim().min(1).max(400),
  fr: z.string().trim().min(1).max(400),
});

/** Adds a tip (appended to the list). */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { en, fr } = createSchema.parse(await req.json());
    const max = await prisma.tip.aggregate({ _max: { sortOrder: true } });
    const tip = await prisma.tip.create({
      data: { en, fr, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
    return json({ tip });
  } catch (err) {
    return handleError(err, req);
  }
}

const patchSchema = z.union([
  z.object({
    id: z.string().min(1),
    en: z.string().trim().min(1).max(400).optional(),
    fr: z.string().trim().min(1).max(400).optional(),
    active: z.boolean().optional(),
  }),
  // Reordering: full list of ids in the new order.
  z.object({ order: z.array(z.string().min(1)).min(1).max(500) }),
]);

/** Updates a tip, or reorders the whole list. */
export async function PATCH(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const body = patchSchema.parse(await req.json());
    if ("order" in body) {
      await prisma.$transaction(
        body.order.map((id, i) => prisma.tip.update({ where: { id }, data: { sortOrder: i } }))
      );
      return json({ ok: true });
    }

    const { id, ...data } = body;
    if (Object.keys(data).length === 0) return apiError(t("invalidData"), 400);
    await prisma.tip.update({ where: { id }, data });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

/** Deletes a tip. */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = deleteSchema.parse(await req.json());
    await prisma.tip.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
