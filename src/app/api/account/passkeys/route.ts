import { z } from "zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import {
  rpID,
  rpName,
  expectedOrigin,
  putChallenge,
  takeChallenge,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@/lib/webauthn";

/** Lists the account's passkeys. */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    const passkeys = await prisma.credential.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    });
    return json({ passkeys, hasPassword: !!user.passwordHash });
  } catch (err) {
    return handleError(err, req);
  }
}

/** Add a passkey — step 1: registration options. */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const existing = await prisma.credential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.name,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
    });
    putChallenge(`reg:${user.id}`, options.challenge);
    return json({ options });
  } catch (err) {
    return handleError(err, req);
  }
}

const verifySchema = z.object({
  response: z.unknown(),
  name: z.string().max(60).optional(),
});

/** Add a passkey — step 2: verify the attestation → store. */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const { response, name } = verifySchema.parse(await req.json());
    const challenge = takeChallenge(`reg:${user.id}`);
    if (!challenge) return apiError(t("passkeyExpired"), 400);

    const verification = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return apiError(t("passkeyFailed"), 400);
    }
    const cred = verification.registrationInfo.credential;
    await prisma.credential.create({
      data: {
        userId: user.id,
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey),
        counter: cred.counter,
        transports: JSON.stringify(cred.transports ?? []),
        name: name?.trim() || "Passkey",
      },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

/** Removes a passkey (never the last sign-in method). */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);

    const { id } = deleteSchema.parse(await req.json());
    const count = await prisma.credential.count({ where: { userId: user.id } });
    if (count <= 1 && !user.passwordHash) {
      return apiError(t("passkeyLastMethod"), 409);
    }
    await prisma.credential.deleteMany({ where: { id, userId: user.id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
