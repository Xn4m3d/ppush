import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { verifyTotp } from "@/lib/totp";

/**
 * Account "verification surface": the metadata we already have to confirm the
 * identity of someone requesting a reset, WITHOUT ever collecting anything
 * more. Admin only. Recent IPs/UAs feed the "usual network/device" challenge
 * — to compare, NEVER to disclose to the requester.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await apiT(req);
  try {
    const admin = await currentUser();
    if (!admin || admin.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
        totpEnabledAt: true,
        credentials: {
          select: { name: true, createdAt: true, lastUsedAt: true },
          orderBy: { createdAt: "asc" },
        },
        apiTokens: {
          select: { name: true, createdAt: true, lastUsedAt: true },
          orderBy: { createdAt: "asc" },
        },
        sessions: {
          select: { ip: true, userAgent: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: { select: { pushes: true, sessions: true } },
      },
    });
    if (!user) return apiError(t("userNotFound"), 404);

    // History of admin actions already performed ON this account.
    const actions = await prisma.adminAudit.findMany({
      where: { targetType: "USER", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, actorEmail: true, action: true, details: true, createdAt: true },
    });

    return json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      hasTotp: !!user.totpEnabledAt,
      hasPasskey: user.credentials.length > 0,
      passkeys: user.credentials,
      apiTokens: user.apiTokens,
      recentSessions: user.sessions,
      pushes: user._count.pushes,
      sessions: user._count.sessions,
      actions,
    });
  } catch (err) {
    return handleError(err, req);
  }
}

const verifySchema = z.object({
  action: z.literal("verifyTotp"),
  code: z.string().min(1).max(12),
});

/** TOTP challenge: verifies a code provided by the requester, without consuming
 *  it (lastAcceptedStep=null) so their next sign-in isn't disrupted. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const admin = await currentUser();
    if (!admin || admin.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id } = await params;
    const { code } = verifySchema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { id },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    if (!user) return apiError(t("userNotFound"), 404);
    if (!user.totpEnabledAt || !user.totpSecret) return json({ valid: false, noTotp: true });

    const valid = verifyTotp(user.totpSecret, code, null) !== null;
    return json({ valid });
  } catch (err) {
    return handleError(err, req);
  }
}
