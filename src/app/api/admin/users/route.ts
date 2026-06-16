import { z } from "zod";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { currentUser, primaryAdminId } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { clientIp } from "@/lib/ratelimit";
import { purgeAccount } from "@/lib/account";
import { adminLog } from "@/lib/admin-audit";
import { createPasswordReset } from "@/lib/reset";
import { verifyTotp } from "@/lib/totp";

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

    const [total, rows] = await Promise.all([
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
          passwordHash: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { pushes: true, credentials: true, sessions: true } },
        },
      }),
    ]);

    // never expose the hash: only whether a password is set
    const users = rows.map(({ passwordHash, ...u }) => ({ ...u, hasPassword: !!passwordHash }));
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
  forceLogout: z.boolean().optional(),
  email: z.string().email().max(255).optional(),
  name: z.string().min(1).max(120).optional(),
  // primary account's TOTP code — required to promote an account to ADMIN.
  totp: z.string().max(12).optional(),
});

export async function PATCH(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const actor = await currentUser();
    if (!actor || actor.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const body = patchSchema.parse(await req.json());
    if (body.id === actor.id) return apiError(t("cannotEditSelf"), 400);

    const target = await prisma.user.findUnique({ where: { id: body.id } });
    if (!target) return apiError(t("userNotFound"), 404);
    const ip = clientIp(req);
    const ref = { type: "USER" as const, id: target.id, label: target.email };

    // Email rectification: reject a duplicate.
    if (body.email && body.email.toLowerCase() !== target.email.toLowerCase()) {
      const clash = await prisma.user.findUnique({ where: { email: body.email } });
      if (clash) return apiError(t("emailTaken"), 409);
    }

    const primaryId = await primaryAdminId();
    // The PRIMARY account can only be managed by itself: no other admin can
    // disable it, rename it, change its email, reset its 2FA,
    // sign it out or change its role (anti privilege-escalation).
    if (target.id === primaryId && actor.id !== primaryId) {
      return apiError(t("cannotEditPrimaryAdmin"), 403);
    }
    // ADMIN promotion = sensitive action: reserved to the PRIMARY account, with
    // 2FA confirmation (primary's TOTP code verified, not consumed).
    if (body.role === "ADMIN" && target.role !== "ADMIN") {
      if (actor.id !== primaryId) return apiError(t("onlyPrimaryPromote"), 403);
      if (!actor.totpEnabledAt || !actor.totpSecret) return apiError(t("promote2faRequired"), 400);
      if (verifyTotp(actor.totpSecret, body.totp ?? "", null) === null) {
        return apiError(t("promote2faInvalid"), 401);
      }
    }

    await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.active === true ? { approvedAt: new Date() } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.resetTotp ? { totpSecret: null, totpEnabledAt: null, totpLastStep: null } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.name ? { name: body.name } : {}),
      },
    });

    // Sessions: invalidated on deactivation or explicit sign-out.
    if (body.active === false || body.forceLogout) {
      await prisma.session.deleteMany({ where: { userId: target.id } });
    }

    // Admin log (one entry per type of action performed).
    if (body.active === false) await adminLog(actor, "USER_DISABLE", ref, { ip });
    if (body.active === true) await adminLog(actor, "USER_ENABLE", ref, { ip });
    if (body.role !== undefined) await adminLog(actor, "USER_ROLE", ref, { ip, details: { role: body.role } });
    if (body.resetTotp) await adminLog(actor, "USER_RESET_2FA", ref, { ip });
    if (body.forceLogout && body.active !== false) await adminLog(actor, "USER_LOGOUT", ref, { ip });
    if (body.email || body.name)
      await adminLog(actor, "USER_EDIT", ref, {
        ip,
        details: {
          ...(body.email ? { email: { from: target.email, to: body.email } } : {}),
          ...(body.name ? { name: { from: target.name, to: body.name } } : {}),
        },
      });

    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}

const resetSchema = z.object({
  id: z.string().min(1),
  action: z.literal("resetPassword"),
  // identity verification basis/bases used — cumulative (totp, passkey,
  // email, knowledge); logged for traceability/accountability.
  verifiedBy: z.array(z.string().max(20)).max(8).optional(),
});

/**
 * Generates a single-use reset token and returns it IN CLEAR only once.
 * The admin browser then wraps it in a ppush push (E2E-encrypted): the admin
 * only gets a ppush link to relay, never seeing the secret in clear.
 */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const actor = await currentUser();
    if (!actor || actor.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id, verifiedBy } = resetSchema.parse(await req.json());
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return apiError(t("userNotFound"), 404);
    // A non-primary admin cannot generate a reset for the PRIMARY
    // account (otherwise super-admin takeover).
    if (target.id === (await primaryAdminId()) && actor.id !== target.id) {
      return apiError(t("cannotEditPrimaryAdmin"), 403);
    }

    const token = await createPasswordReset(target.id, actor.id);
    await adminLog(actor, "USER_RESET_PW", { type: "USER", id: target.id, label: target.email }, {
      ip: clientIp(req),
      details: verifiedBy ? { verifiedBy } : undefined,
    });
    return json({ token, url: `${config.baseUrl}/reset-password#${token}`, email: target.email });
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
    const actor = await currentUser();
    if (!actor || actor.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = deleteSchema.parse(await req.json());
    if (id === actor.id) return apiError(t("cannotEditSelf"), 400);
    if (id === (await primaryAdminId())) return apiError(t("cannotDeletePrimaryAdmin"), 403);

    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    // Profile + content erased immediately; connection log kept
    // for the hosting provider's legal retention period (see purgeAccount).
    await purgeAccount(id);
    await adminLog(actor, "USER_DELETE", { type: "USER", id, label: target?.email ?? null }, {
      ip: clientIp(req),
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
