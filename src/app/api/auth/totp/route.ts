import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { checkTotpTicket, consumeTotpTicket } from "@/lib/totp-tickets";
import { verifyTotp } from "@/lib/totp";

const schema = z.object({
  ticket: z.string().min(1).max(64),
  code: z.string().min(6).max(10),
});

/** Second login step for accounts with 2FA. */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`totp:${ip}`, 15, 5 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }

    const { ticket, code } = schema.parse(await req.json());
    const userId = checkTotpTicket(ticket);
    if (!userId) {
      return json({ error: t("totpTicketExpired"), code: "ticket_expired" }, 401);
    }
    // Per-account cap (not IP-spoofable): bounds TOTP code guessing regardless of
    // ticket churn or IP.
    if (!rateLimit(`totp-verify:${userId}`, 10, 15 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.active || !user.totpSecret || !user.totpEnabledAt) {
      consumeTotpTicket(ticket);
      return json({ error: t("totpTicketExpired"), code: "ticket_expired" }, 401);
    }

    const step = verifyTotp(user.totpSecret, code, user.totpLastStep);
    if (step === null) return apiError(t("totpInvalidCode"), 401);

    consumeTotpTicket(ticket);
    await prisma.user.update({
      where: { id: user.id },
      data: { totpLastStep: step, lastLoginAt: new Date() },
    });
    const token = await createSession(user.id, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await setSessionCookie(token);

    return json({ ok: true, role: user.role });
  } catch (err) {
    return handleError(err, req);
  }
}
