import { prisma } from "./db";
import { config } from "./config";
import type { User } from "@/generated/prisma/client";

/**
 * Administration action log (traceability / GDPR accountability: admins access
 * personal metadata). Actor + email are denormalized to survive deletion of the
 * admin account. The IP is subject to the same `LOG_IPS` as the rest, and
 * anonymized at expiry by the sweeper.
 */
export type AdminAction =
  | "USER_DISABLE"
  | "USER_ENABLE"
  | "USER_ROLE"
  | "USER_EDIT"
  | "USER_RESET_PW"
  | "USER_RESET_2FA"
  | "USER_LOGOUT"
  | "USER_DELETE"
  | "PUSH_TAKEDOWN"
  | "RECOVERY_HANDLE"
  | "RECOVERY_REJECT";

export async function adminLog(
  actor: Pick<User, "id" | "email">,
  action: AdminAction,
  target: { type: "USER" | "PUSH"; id?: string | null; label?: string | null },
  meta?: { ip?: string | null; details?: Record<string, unknown> }
): Promise<void> {
  await prisma.adminAudit.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetType: target.type,
      targetId: target.id ?? null,
      targetLabel: target.label ?? null,
      details: meta?.details ? JSON.stringify(meta.details) : null,
      ip: config.logIps ? meta?.ip ?? null : null,
    },
  });
}
