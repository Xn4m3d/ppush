import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { currentUser, clearSessionCookie, verifyPassword, primaryAdminId } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { purgeAccount } from "@/lib/account";
import { verifyTotp } from "@/lib/totp";
import {
  rpID,
  expectedOrigin,
  putChallenge,
  takeChallenge,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@/lib/webauthn";

/** Passkey re-authentication (passwordless accounts) before deletion. */
export async function POST(req: Request) {
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
    putChallenge(`del:${user.id}`, options.challenge);
    return json({ options });
  } catch (err) {
    return handleError(err, req);
  }
}

const schema = z.object({
  confirmEmail: z.string().min(1).max(255),
  password: z.string().max(256).optional(),
  code: z.string().max(10).optional(),
  passkey: z.unknown().optional(),
});

/**
 * Self-service account deletion (GDPR right to erasure), immediate and
 * permanent. Requires a fresh RE-AUTHENTICATION (password + TOTP, or passkey
 * re-assertion): the email confirmation is only a UX safeguard.
 */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const { confirmEmail, password, code, passkey } = schema.parse(await req.json());
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return apiError(t("deleteConfirmMismatch"), 400);
    }

    // the primary admin (first account) is never deletable
    if (user.id === (await primaryAdminId())) {
      return apiError(t("cannotDeletePrimaryAdmin"), 403);
    }
    // safeguard: never leave the service without any administrator
    if (user.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
      return apiError(t("deleteLastAdmin"), 409);
    }

    // re-authentication
    if (user.passwordHash) {
      if (!(await verifyPassword(user.passwordHash, password ?? ""))) {
        return apiError(t("wrongPassword"), 401);
      }
      if (user.totpEnabledAt && user.totpSecret) {
        if (verifyTotp(user.totpSecret, code ?? "", user.totpLastStep) === null) {
          return apiError(t("totpInvalidCode"), 401);
        }
      }
    } else {
      // passwordless account → passkey re-assertion
      const challenge = takeChallenge(`del:${user.id}`);
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

    // Profile + content erased immediately; connection log kept for the
    // duration of the host's legal obligation (see purgeAccount).
    await purgeAccount(user.id);
    await clearSessionCookie();
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
