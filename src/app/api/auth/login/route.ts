import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueTotpTicket } from "@/lib/totp-tickets";

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 10, 15 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }

    const { email, password } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // verify even if the user doesn't exist OR has no password (passkey-only account)
    // → no timing oracle nor leak about the account's existence
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, password)
      : (await verifyPassword(
          "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          password
        ),
        false);

    if (!user || !valid) {
      return apiError(t("invalidCredentials"), 401);
    }
    if (!user.active) {
      return apiError(
        user.approvedAt
          ? t("accountDisabled")
          : t("accountPending"),
        403
      );
    }

    // 2FA enabled → ephemeral ticket, the session waits for the TOTP code
    if (user.totpEnabledAt && user.totpSecret) {
      return json({ totpRequired: true, ticket: issueTotpTicket(user.id) });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
