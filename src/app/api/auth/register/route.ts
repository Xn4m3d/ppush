import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  isAllowedEmail,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { config } from "@/lib/config";

import type { ApiTranslator } from "@/lib/i18n-api";
import { EMAIL_RE } from "@/lib/validation";

const schema = (t: ApiTranslator) =>
  z.object({
    email: z.string().trim().max(255).regex(EMAIL_RE, t("emailInvalid")),
    name: z.string().trim().min(1, t("nameRequired")).max(100),
    password: z.string().min(12, t("passwordMin")).max(256),
    turnstileToken: z.string().max(4096).optional(),
  });

export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`register:${ip}`, 5, 15 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }

    const { email, name, password, turnstileToken } = schema(t).parse(await req.json());

    // Anti-bot: Turnstile verification (no-op if not configured server-side).
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return apiError(t("captchaFailed"), 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isAllowedEmail(normalizedEmail)) {
      return apiError(
        t("registerDomains", {
          domains: config.allowedDomains.map((d) => "@" + d).join(", "),
        }),
        403
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) return apiError(t("emailTaken"), 409);

    const userCount = await prisma.user.count();
    const isFirst = userCount === 0;
    const pending = config.requireApproval && !isFirst;
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: await hashPassword(password),
        role: isFirst ? "ADMIN" : "USER", // premier compte = admin
        active: !pending,
        approvedAt: pending ? null : new Date(),
        lastLoginAt: pending ? null : new Date(),
      },
    });

    if (pending) {
      return json({ ok: true, pending: true }, 201);
    }

    const token = await createSession(user.id, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await setSessionCookie(token);

    return json({ ok: true, role: user.role }, 201);
  } catch (err) {
    return handleError(err, req);
  }
}
