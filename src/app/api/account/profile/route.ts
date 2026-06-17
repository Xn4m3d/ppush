import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { currentUser, verifyPassword } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/ratelimit";
import {
  rpID,
  expectedOrigin,
  putChallenge,
  takeChallenge,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@/lib/webauthn";

/** Passkey re-auth: authentication options for a passwordless account
 *  (required to change the email of a passwordless account). */
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
    putChallenge(`profile:${user.id}`, options.challenge);
    return json({ options });
  } catch (err) {
    return handleError(err, req);
  }
}

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().max(255).optional(),
  currentPassword: z.string().max(256).optional(),
  passkey: z.unknown().optional(),
});

/**
 * Updates the account's name and/or email. The name is free; changing the email
 * (= sign-in identifier) requires re-authentication: current password,
 * or a passkey re-assertion for a passwordless account.
 */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const b = schema.parse(await req.json());
    const data: { name?: string; email?: string } = {};
    if (b.name && b.name !== user.name) data.name = b.name;

    const emailChanging = !!b.email && b.email.toLowerCase() !== user.email.toLowerCase();
    if (emailChanging) {
      // anti brute-force of the current password via a stolen session
      if (!rateLimit(`profile:${user.id}`, 10, 15 * 60_000)) {
        return apiError(t("passwordTooMany"), 429);
      }
      // Re-auth: account WITH a password → verify the current one; WITHOUT (passkey
      // only) → fresh passkey re-assertion (email is the login identifier,
      // a stolen session must not be able to swap it to evict the owner).
      if (user.passwordHash) {
        if (!(await verifyPassword(user.passwordHash, b.currentPassword ?? ""))) {
          return apiError(t("wrongCurrentPassword"), 401);
        }
      } else {
        const challenge = takeChallenge(`profile:${user.id}`);
        if (!challenge) return apiError(t("passkeyExpired"), 400);
        const assertion = b.passkey as AuthenticationResponseJSON | undefined;
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
      // Email uniqueness.
      const clash = await prisma.user.findUnique({ where: { email: b.email! } });
      if (clash) return apiError(t("emailTaken"), 409);
      data.email = b.email;
    }

    if (Object.keys(data).length === 0) return json({ ok: true });
    await prisma.user.update({ where: { id: user.id }, data });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
