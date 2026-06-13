import { requireUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT, requestLocale } from "@/lib/i18n-api";
import { writeBlob, TooLargeError } from "@/lib/files";
import { config } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  storageStatus,
  storageFullMessage,
  userStorageStatus,
  userQuotaFullMessage,
  invalidateStorageCache,
} from "@/lib/storage";

/**
 * Upload an encrypted blob (file). The client encrypts BEFORE the upload —
 * the server only sees opaque bytes. Returns the blobPath to pass to
 * POST /api/pushes. Open to anonymous users (10 MB cap) and accounts (100 MB).
 */
export async function POST(req: Request) {
  const t = await apiT(req);
  const locale = requestLocale(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const user = await requireUser(req);
    const capMb = user ? config.limits.user.maxFileMb : config.limits.anon.maxFileMb;

    // Anti-abuse: anonymous uploads capped per IP.
    if (!user && !rateLimit(`blob:${clientIp(req)}`, 10, 60 * 60_000)) {
      return apiError(t("blobAnonLimit"), 429);
    }
    // Accounts too: each blob can be up to 100 MB; without a cap a free
    // account could saturate the disk.
    if (user && !rateLimit(`blob:user:${user.id}`, 30, 60 * 60_000)) {
      return apiError(t("blobUserLimit"), 429);
    }
    if (!req.body) return apiError(t("missingBody"), 400);

    const maxBytes = capMb * 1024 * 1024 + 2 * 1024 * 1024; // encryption margin

    // Storage fair-use: explained refusal when the dedicated space is full
    // (global) or when the account's active-files quota is reached.
    const storage = await storageStatus();
    const userStorage =
      user && config.userStorageQuotaGb > 0 ? await userStorageStatus(user.id) : null;
    const declared = parseInt(req.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declared)) {
      if (declared > maxBytes) return apiError(t("fileTooBig"), 413);
      if (declared > storage.availableBytes) {
        return apiError(storageFullMessage(storage, declared, t, locale), 507);
      }
      if (userStorage && declared > userStorage.availableBytes) {
        return apiError(userQuotaFullMessage(userStorage, declared, t, locale), 507);
      }
    }

    const limit = Math.min(
      maxBytes,
      storage.availableBytes,
      userStorage?.availableBytes ?? Infinity
    );
    try {
      const { relPath, size } = await writeBlob(req.body, limit);
      invalidateStorageCache();
      return json({ blobPath: relPath, size }, 201);
    } catch (err) {
      if (err instanceof TooLargeError && limit < maxBytes) {
        // it's the space (global or account quota) that blocked, not the per-file cap
        return userStorage && userStorage.availableBytes <= storage.availableBytes
          ? apiError(userQuotaFullMessage(userStorage, limit + 1, t, locale), 507)
          : apiError(storageFullMessage(storage, limit + 1, t, locale), 507);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof TooLargeError) {
      return apiError(t("fileTooBig"), 413);
    }
    return handleError(err, req);
  }
}
