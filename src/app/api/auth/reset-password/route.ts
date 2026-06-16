import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT, type ApiTranslator } from "@/lib/i18n-api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { findValidReset } from "@/lib/reset";

/** Checks a reset token's validity (the /reset-password page). */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    if (!rateLimit(`reset-check:${clientIp(req)}`, 30, 15 * 60_000)) {
      return apiError(t("passwordTooMany"), 429);
    }
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const reset = await findValidReset(token);
    if (!reset) return apiError(t("resetInvalid"), 400);
    const user = await prisma.user.findUnique({
      where: { id: reset.userId },
      select: { email: true },
    });
    return json({ valid: true, email: user?.email ?? null });
  } catch (err) {
    return handleError(err, req);
  }
}

const schema = (t: ApiTranslator) =>
  z.object({
    token: z.string().min(1),
    newPassword: z.string().min(12, t("newPasswordMin")).max(256),
  });

/** Consumes the token (single-use) and sets the new password. */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000)) {
      return apiError(t("passwordTooMany"), 429);
    }
    const { token, newPassword } = schema(t).parse(await req.json());
    const reset = await findValidReset(token);
    if (!reset) return apiError(t("resetInvalid"), 400);

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // all existing sessions are invalidated (the account just changed its key)
      prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ]);

    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
