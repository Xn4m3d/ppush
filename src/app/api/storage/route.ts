import { json, apiError, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { storageStatus, userStorageStatus } from "@/lib/storage";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Fair-use transparency: actually available space for files and upcoming
 * release milestones (cumulative — never per-push detail).
 * Authenticated: adds the personal active-files quota status.
 */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    if (!rateLimit(`storage:${clientIp(req)}`, 30, 60_000)) {
      return apiError(t("tooManyRequests"), 429);
    }
    const s = await storageStatus();

    const milestones: { bytes: number; at: string }[] = [];
    let cumulated = 0;
    for (const lib of s.upcoming) {
      cumulated += lib.bytes;
      const at = lib.at.toISOString();
      const last = milestones[milestones.length - 1];
      if (last && last.at === at) last.bytes = cumulated;
      else milestones.push({ bytes: cumulated, at });
      if (milestones.length >= 5) break;
    }

    const user = await requireUser(req);
    const personal =
      user && config.userStorageQuotaGb > 0 ? await userStorageStatus(user.id) : null;

    return json({
      availableBytes: s.availableBytes,
      upcoming: milestones,
      ...(personal && {
        user: {
          usedBytes: personal.usedBytes,
          availableBytes: personal.availableBytes,
          quotaBytes: personal.quotaBytes,
        },
      }),
    });
  } catch (err) {
    return handleError(err, req);
  }
}
