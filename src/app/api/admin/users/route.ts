import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, primaryAdminId } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { purgeAccount } from "@/lib/account";

const PER_PAGE = 20;

export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const filter = url.searchParams.get("filter"); // active | pending | disabled | admin

    const where = {
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}),
      ...(filter === "active"
        ? { active: true }
        : filter === "pending"
          ? { active: false, approvedAt: null }
          : filter === "disabled"
            ? { active: false, approvedAt: { not: null } }
            : filter === "admin"
              ? { role: "ADMIN" }
              : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          approvedAt: true,
          totpEnabledAt: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { pushes: true, credentials: true } },
        },
      }),
    ]);

    return json({ users, total, page, perPage: PER_PAGE, primaryAdminId: await primaryAdminId() });
  } catch (err) {
    return handleError(err, req);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  resetTotp: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id, active, role, resetTotp } = patchSchema.parse(await req.json());
    if (id === user.id) return apiError(t("cannotEditSelf"), 400);

    await prisma.user.update({
      where: { id },
      data: {
        ...(active !== undefined ? { active } : {}),
        // enabling counts as approval (pending accounts)
        ...(active === true ? { approvedAt: new Date() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(resetTotp
          ? { totpSecret: null, totpEnabledAt: null, totpLastStep: null }
          : {}),
      },
    });
    if (active === false) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

/** Permanent deletion of an account + all its data (GDPR / anti-abuse). */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = deleteSchema.parse(await req.json());
    if (id === user.id) return apiError(t("cannotEditSelf"), 400);
    if (id === (await primaryAdminId())) return apiError(t("cannotDeletePrimaryAdmin"), 403);

    // Profile + content erased immediately; connection log kept for the
    // duration of the host's legal obligation (see purgeAccount).
    await purgeAccount(id);
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
