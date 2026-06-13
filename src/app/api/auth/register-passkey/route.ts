import { z } from "zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { isAllowedEmail, createSession, setSessionCookie } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT, type ApiTranslator } from "@/lib/i18n-api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { config } from "@/lib/config";
import { randomToken } from "@/lib/tokens";
import { EMAIL_RE } from "@/lib/validation";
import {
  rpID,
  rpName,
  expectedOrigin,
  newFlowId,
  putSignup,
  takeSignup,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@/lib/webauthn";

const startSchema = (t: ApiTranslator) =>
  z.object({
    email: z.string().trim().max(255).regex(EMAIL_RE, t("emailInvalid")),
    name: z.string().trim().min(1, t("nameRequired")).max(100),
    turnstileToken: z.string().max(4096).optional(),
  });

/** Passwordless registration — step 1: validate + return passkey options. */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`register:${ip}`, 5, 15 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }
    const { email, name, turnstileToken } = startSchema(t).parse(await req.json());
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return apiError(t("captchaFailed"), 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!isAllowedEmail(normalizedEmail)) {
      return apiError(
        t("registerDomains", { domains: config.allowedDomains.map((d) => "@" + d).join(", ") }),
        403
      );
    }
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
      return apiError(t("emailTaken"), 409);
    }

    const userId = randomToken(24);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: normalizedEmail,
      userID: new TextEncoder().encode(userId),
      userDisplayName: name.trim(),
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    const flowId = newFlowId();
    putSignup(flowId, { email: normalizedEmail, name: name.trim(), userId, challenge: options.challenge });
    return json({ flowId, options });
  } catch (err) {
    return handleError(err, req);
  }
}

const verifySchema = z.object({
  flowId: z.string().min(1).max(64),
  response: z.unknown(),
});

/** Passwordless registration — step 2: create the account (no password) + the passkey. */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`register:${ip}`, 8, 15 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }
    const { flowId, response } = verifySchema.parse(await req.json());
    const ticket = takeSignup(flowId);
    if (!ticket) return apiError(t("passkeyExpired"), 400);

    const verification = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: ticket.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return apiError(t("passkeyFailed"), 400);
    }
    if (await prisma.user.findUnique({ where: { email: ticket.email } })) {
      return apiError(t("emailTaken"), 409);
    }

    const cred = verification.registrationInfo.credential;
    const isFirst = (await prisma.user.count()) === 0;
    const pending = config.requireApproval && !isFirst;

    const user = await prisma.user.create({
      data: {
        id: ticket.userId,
        email: ticket.email,
        name: ticket.name,
        passwordHash: null, // compte passwordless
        role: isFirst ? "ADMIN" : "USER",
        active: !pending,
        approvedAt: pending ? null : new Date(),
        lastLoginAt: pending ? null : new Date(),
        credentials: {
          create: {
            credentialId: cred.id,
            publicKey: Buffer.from(cred.publicKey),
            counter: cred.counter,
            transports: JSON.stringify(cred.transports ?? []),
            name: "Passkey",
          },
        },
      },
    });

    if (pending) return json({ ok: true, pending: true }, 201);

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
