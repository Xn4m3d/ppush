import { z } from "zod";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

const schema = z.object({
  email: z.string().email().max(255),
  message: z.string().trim().min(10).max(2000),
  contact: z.string().trim().max(200).optional(),
  turnstileToken: z.string().optional(),
});

/**
 * Public access-recovery request (no automatic reset email). The locked-out
 * user describes their proof of identity; the request lands in the admin area
 * (Requests tab) where a human verifies it, then generates a reset link sent
 * out-of-band. Anti-enumeration: we always answer "ok", without revealing
 * whether the email matches an account. Anti-abuse: Origin + rate limit
 * (+ Turnstile if configured).
 */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`recover:${ip}`, 3, 60 * 60_000) || !rateLimit("recover:all", 60, 60 * 60_000)) {
      return apiError(t("recoveryTooMany"), 429);
    }

    const { email, message, contact, turnstileToken } = schema.parse(await req.json());

    if (config.turnstileSiteKey && !(await verifyTurnstile(turnstileToken, ip))) {
      return apiError(t("captchaFailed"), 400);
    }

    await prisma.recoveryRequest.create({
      data: {
        email: email.toLowerCase(),
        message,
        contact: contact || null,
        ip: config.logIps ? ip : null,
        userAgent: config.logIps ? req.headers.get("user-agent")?.slice(0, 300) ?? null : null,
      },
    });

    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
