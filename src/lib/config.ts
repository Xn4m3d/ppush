import path from "node:path";

function int(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type Tier = "anon" | "user";
export type PushKind = "PASSWORD" | "TEXT" | "FILE" | "URL";

export const config = {
  /** Domains allowed to create an account (empty = all domains). */
  allowedDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean),

  /** New accounts require admin approval. */
  requireApproval: process.env.REQUIRE_APPROVAL === "true",

  /** Data directory (SQLite + encrypted blobs). */
  dataDir: process.env.DATA_DIR ?? path.join(process.cwd(), "data"),

  /** Public URL of the instance (used to build share links). */
  baseUrl: (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),

  /** Max size of an encrypted text/password/URL payload, in KB (hard cap, all tiers). */
  maxTextSizeKb: int("MAX_TEXT_SIZE_KB", 1024),

  /** Session lifetime, in days. */
  sessionDays: int("SESSION_DAYS", 14),

  /** Keep IPs in the audit log. */
  logIps: process.env.LOG_IPS !== "false",

  /** Retention of personal data (audit-log IP/UA), in days.
   *  Beyond that, the sweeper anonymizes them (per the privacy policy). */
  dataRetentionDays: int("DATA_RETENTION_DAYS", 365),

  /** Cloudflare Turnstile (anti-bot at registration). Empty = disabled. */
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY ?? "",
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? "",

  /** Application quota on blobs in GB (0 = no quota, only disk space bounds). */
  storageQuotaGb: int("STORAGE_QUOTA_GB", 0),

  /** Active-files quota per account, in GB (0 = no per-account quota). */
  userStorageQuotaGb: int("USER_STORAGE_QUOTA_GB", 3),

  /**
   * Per-tier limits. ANONYMOUS (no account) = deliberately strict, to
   * encourage registration and limit abuse. REGISTERED = perks (larger files,
   * longer retention, history + view tracking).
   */
  limits: {
    anon: {
      maxDays: int("ANON_MAX_DAYS", 7),
      maxViews: int("ANON_MAX_VIEWS", 5),
      maxFileMb: int("ANON_MAX_FILE_MB", 10),
      maxFileDays: int("ANON_MAX_FILE_DAYS", 10),
      defaultDays: int("ANON_DEFAULT_DAYS", 2),
      defaultViews: int("ANON_DEFAULT_VIEWS", 1),
    },
    user: {
      maxDays: int("USER_MAX_DAYS", 30),
      maxViews: int("USER_MAX_VIEWS", 50),
      maxFileMb: int("MAX_FILE_SIZE_MB", 100),
      maxFileDays: int("USER_MAX_FILE_DAYS", 30),
    },
  },
};

/** Effective caps (days / views / file size) for a tier + push kind. */
export function pushLimits(tier: Tier, kind?: PushKind) {
  const isFile = kind === "FILE";
  if (tier === "anon") {
    const a = config.limits.anon;
    return { maxDays: isFile ? a.maxFileDays : a.maxDays, maxViews: a.maxViews, maxFileMb: a.maxFileMb };
  }
  const u = config.limits.user;
  return { maxDays: isFile ? u.maxFileDays : u.maxDays, maxViews: u.maxViews, maxFileMb: u.maxFileMb };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function blobDir(): string {
  return path.join(config.dataDir, "blobs");
}
