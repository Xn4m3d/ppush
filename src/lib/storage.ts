/**
 * Storage fair-use: actually available space for blobs and an estimate of
 * upcoming releases (expiry of existing files). Blobs live on a dedicated
 * volume; an optional application quota (STORAGE_QUOTA_GB) further bounds
 * ppush's share.
 */

import path from "node:path";
import fsp from "node:fs/promises";
import { prisma } from "./db";
import { blobDir, config } from "./config";
import { formatBytes, formatDelay } from "./format";
import type { Locale } from "@/i18n/locale";
import type { ApiTranslator } from "./i18n-api";

/** Reserved margin on the volume (DB, tmp, safety). */
const RESERVE_BYTES = 2 * 1024 ** 3;

export type Liberation = { bytes: number; at: Date };

export type StorageStatus = {
  /** Bytes occupied by ppush blobs. */
  usedBytes: number;
  /** What an upload can still consume (margin and quota deducted). */
  availableBytes: number;
  quotaBytes: number | null;
  /** Upcoming releases, sorted chronologically (latest-possible expiry). */
  upcoming: Liberation[];
};

let cache: { at: number; status: StorageStatus } | null = null;

export function invalidateStorageCache(): void {
  cache = null;
}

export async function storageStatus(): Promise<StorageStatus> {
  if (cache && Date.now() - cache.at < 15_000) return cache.status;

  let usedBytes = 0;
  try {
    const dir = blobDir();
    for (const entry of await fsp.readdir(dir)) {
      const st = await fsp.stat(path.join(dir, entry)).catch(() => null);
      if (st?.isFile()) usedBytes += st.size;
    }
  } catch {
    // directory not created yet → 0 bytes used
  }

  // statfs on the blob directory: that is what lives on the dedicated volume
  // (nested mount under data/) — not dataDir, which may be elsewhere.
  let realFree = 0;
  try {
    const st = await fsp.statfs(blobDir()).catch(() => fsp.statfs(config.dataDir));
    realFree = Number(st.bavail) * Number(st.bsize);
  } catch {
    // statfs unavailable → only the quota counts
    realFree = Number.MAX_SAFE_INTEGER;
  }

  const quotaBytes = config.storageQuotaGb > 0 ? config.storageQuotaGb * 1024 ** 3 : null;
  let availableBytes = Math.max(0, realFree - RESERVE_BYTES);
  if (quotaBytes !== null) {
    availableBytes = Math.min(availableBytes, Math.max(0, quotaBytes - usedBytes));
  }

  const files = await prisma.push.findMany({
    where: {
      kind: "FILE",
      payloadDeleted: false,
      fileSize: { not: null },
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
    select: { fileSize: true, expiresAt: true },
    take: 200,
  });
  const upcoming = files.map((f) => ({ bytes: f.fileSize ?? 0, at: f.expiresAt }));

  const status: StorageStatus = { usedBytes, availableBytes, quotaBytes, upcoming };
  cache = { at: Date.now(), status };
  return status;
}

export type UserStorageStatus = {
  /** Bytes of active (non-purged) files owned by the account. */
  usedBytes: number;
  availableBytes: number;
  quotaBytes: number;
  upcoming: Liberation[];
};

/** Per-account fair-use quota: sum of the account's active files. */
export async function userStorageStatus(userId: string): Promise<UserStorageStatus> {
  const quotaBytes = config.userStorageQuotaGb * 1024 ** 3;
  const files = await prisma.push.findMany({
    where: { userId, kind: "FILE", payloadDeleted: false, fileSize: { not: null } },
    orderBy: { expiresAt: "asc" },
    select: { fileSize: true, expiresAt: true },
  });
  const now = Date.now();
  const usedBytes = files.reduce((s, f) => s + (f.fileSize ?? 0), 0);
  return {
    usedBytes,
    availableBytes: Math.max(0, quotaBytes - usedBytes),
    quotaBytes,
    upcoming: files
      .filter((f) => f.expiresAt.getTime() > now)
      .map((f) => ({ bytes: f.fileSize ?? 0, at: f.expiresAt })),
  };
}

/** "Personal quota reached" message: upcoming releases + possible action. */
export function userQuotaFullMessage(
  status: UserStorageStatus,
  neededBytes: number,
  t: ApiTranslator,
  locale: Locale
): string {
  const base = t("quotaFullBase", { quota: formatBytes(status.quotaBytes, locale) });
  let cumulated = 0;
  for (const lib of status.upcoming) {
    cumulated += lib.bytes;
    if (status.availableBytes + cumulated >= neededBytes) {
      return t("quotaFullFreeing", {
        base,
        freed: formatBytes(cumulated, locale),
        delay: formatDelay(lib.at.getTime() - Date.now(), locale),
      });
    }
  }
  return t("quotaFullNone", {
    base,
    available: formatBytes(status.availableBytes, locale),
  });
}

/**
 * "Storage full" message: explains the fair-use policy and indicates when
 * enough space will be freed for `neededBytes` (files may also expire earlier
 * once their views are exhausted, hence "at the latest").
 */
export function storageFullMessage(
  status: StorageStatus,
  neededBytes: number,
  t: ApiTranslator,
  locale: Locale
): string {
  const base = t("storageFullBase");
  let cumulated = 0;
  for (const lib of status.upcoming) {
    cumulated += lib.bytes;
    if (status.availableBytes + cumulated >= neededBytes) {
      return t("storageFullFreeing", {
        base,
        freed: formatBytes(cumulated, locale),
        delay: formatDelay(lib.at.getTime() - Date.now(), locale),
      });
    }
  }
  if (cumulated > 0) {
    const last = status.upcoming[status.upcoming.length - 1];
    return t("storageFullInsufficient", {
      base,
      freed: formatBytes(cumulated, locale),
      delay: formatDelay(last.at.getTime() - Date.now(), locale),
      needed: formatBytes(neededBytes, locale),
    });
  }
  return t("storageFullNone", {
    base,
    available: formatBytes(status.availableBytes, locale),
  });
}
