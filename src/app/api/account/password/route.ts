import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { currentUser, verifyPassword, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT, type ApiTranslator } from "@/lib/i18n-api";
import { sha256 } from "@/lib/tokens";
import { rateLimit } from "@/lib/ratelimit";
import { cookies } from "next/headers";
import {
  rpID,
  expectedOrigin,
  putChallenge,
  takeChallenge,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@/lib/webauthn";

const schema = (t: ApiTranslator) =>
  z.object({
    // optional: absent when the account has no password yet (passkey only)
    currentPassword: z.string().max(256).optional(),
    newPassword: z.string().min(12, t("newPasswordMin")).max(256),
    // passkey re-assertion, required to set the first password of a passwordless account
    passkey: z.unknown().optional(),
  });

/** Passkey re-auth: authentication options for a passwordless account. */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    const creds = await prisma.credential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
    });
    putChallenge(`pwd:${user.id}`, options.challenge);
    return json({ options });
  } catch (err) {
    return handleError(err, req);
  }
}

export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    // Prevents brute-forcing the current password via a stolen session.
    if (!rateLimit(`pwchange:${user.id}`, 10, 15 * 60_000)) {
      return apiError(t("passwordTooMany"), 429);
    }

    const { currentPassword, newPassword, passkey } = schema(t).parse(await req.json());
    if (user.passwordHash) {
      // Account WITH a password → require and verify the current one (change).
      if (!(await verifyPassword(user.passwordHash, currentPassword ?? ""))) {
        return apiError(t("wrongCurrentPassword"), 401);
      }
    } else {
      // Account WITHOUT a password (passkey only): setting a first password
      // creates a new sign-in factor → require a fresh passkey re-assertion.
      // Otherwise a stolen session could grant itself a password then delete the
      // passkeys → full account takeover + owner lockout.
      const challenge = takeChallenge(`pwd:${user.id}`);
      if (!challenge) return apiError(t("passkeyExpired"), 400);
      const assertion = passkey as AuthenticationResponseJSON | undefined;
      if (!assertion?.id) return apiError(t("passkeyFailed"), 401);
      const cred = await prisma.credential.findFirst({
        where: { credentialId: assertion.id, userId: user.id },
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
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // Invalidate all other sessions
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        ...(token ? { tokenHash: { not: sha256(token) } } : {}),
      },
    });

    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
