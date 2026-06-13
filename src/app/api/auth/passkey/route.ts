import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  rpID,
  expectedOrigin,
  newFlowId,
  putChallenge,
  takeChallenge,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@/lib/webauthn";

/** Passwordless login — step 1: authentication options (discoverable). */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    if (!rateLimit(`pk-login:${clientIp(req)}`, 30, 5 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
    });
    const flowId = newFlowId();
    putChallenge(`login:${flowId}`, options.challenge);
    return json({ flowId, options });
  } catch (err) {
    return handleError(err, req);
  }
}

const verifySchema = z.object({
  flowId: z.string().min(1).max(64),
  response: z.unknown(),
});

/** Passwordless login — step 2: verify the assertion → create the session. */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    if (!rateLimit(`pk-login:${ip}`, 30, 5 * 60_000)) {
      return apiError(t("loginTooMany"), 429);
    }
    const { flowId, response } = verifySchema.parse(await req.json());
    const assertion = response as AuthenticationResponseJSON;

    const challenge = takeChallenge(`login:${flowId}`);
    if (!challenge) return apiError(t("passkeyExpired"), 400);

    const cred = await prisma.credential.findUnique({
      where: { credentialId: assertion.id },
    });
    if (!cred) return apiError(t("passkeyUnknown"), 401);

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      },
    });
    if (!verification.verified) return apiError(t("passkeyFailed"), 401);

    const user = await prisma.user.findUnique({ where: { id: cred.userId } });
    if (!user) return apiError(t("passkeyUnknown"), 401);
    if (!user.active) {
      return apiError(user.approvedAt ? t("accountDisabled") : t("accountPending"), 403);
    }

    await prisma.credential.update({
      where: { id: cred.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

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
