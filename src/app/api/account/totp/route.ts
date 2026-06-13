import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, verifyPassword } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/ratelimit";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

/** Activation step 1: generates a provisional secret + URI for the QR. */
export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    if (user.totpEnabledAt) return apiError(t("totpAlreadyEnabled"), 409);

    const secret = generateTotpSecret();
    // stored but inactive while totpEnabledAt is null
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret, totpLastStep: null },
    });
    return json({ secret, uri: otpauthUri(secret, user.email) });
  } catch (err) {
    return handleError(err, req);
  }
}

const confirmSchema = z.object({ code: z.string().min(6).max(10) });

/** Step 2: confirm with a first valid code → enable 2FA. */
export async function PUT(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    if (user.totpEnabledAt) return apiError(t("totpAlreadyEnabled"), 409);
    if (!user.totpSecret) return apiError(t("totpSetupFirst"), 400);

    if (!rateLimit(`totp-enable:${user.id}`, 10, 5 * 60_000)) {
      return apiError(t("totpTooMany"), 429);
    }

    const { code } = confirmSchema.parse(await req.json());
    const step = verifyTotp(user.totpSecret, code, null);
    if (step === null) return apiError(t("totpInvalidCodeCheck"), 401);

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date(), totpLastStep: step },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}

const disableSchema = z.object({
  // optional: a passkey-only account has no password
  password: z.string().max(256).optional(),
  code: z.string().min(6).max(10),
});

/** Deactivation: requires password AND current TOTP code. */
export async function DELETE(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await currentUser();
    if (!user) return apiError(t("authRequired"), 401);
    if (!user.totpEnabledAt || !user.totpSecret) {
      return apiError(t("totpNotEnabled"), 400);
    }

    if (!rateLimit(`totp-disable:${user.id}`, 10, 5 * 60_000)) {
      return apiError(t("totpTooMany"), 429);
    }

    const { password, code } = disableSchema.parse(await req.json());
    // Passkey-only accounts (no password): the session + the TOTP code are
    // enough; otherwise the password is required.
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, password ?? ""))) {
      return apiError(t("wrongPassword"), 401);
    }
    if (verifyTotp(user.totpSecret, code, user.totpLastStep) === null) {
      return apiError(t("totpInvalidCode"), 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
