import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { randomToken } from "@/lib/tokens";
import { config, pushLimits } from "@/lib/config";
import { audit, ownerPushView } from "@/lib/pushes";
import { blobSize } from "@/lib/files";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const createSchema = z.object({
  kind: z.enum(["PASSWORD", "TEXT", "FILE", "URL"]),
  /** Client-side encrypted payload, base64. For FILE: encrypted metadata. */
  ciphertext: z.string().min(1),
  /** For FILE: blob identifier returned by POST /api/blobs. */
  blobPath: z
    .string()
    .regex(/^[A-Za-z0-9]{32}\.bin$/)
    .optional(),
  passphrase: z.string().min(1).max(256).optional(),
  /** Validity duration, in minutes (5 min .. 365 d). */
  expireAfterMinutes: z.number().int().min(5).max(525_600).optional(),
  /** API backward-compat: duration in days (converted to minutes if provided). */
  expireAfterDays: z.number().int().min(1).max(365).optional(),
  expireAfterViews: z.number().int().min(1),
  retrievalStep: z.boolean().default(true),
  deletableByViewer: z.boolean().default(true),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const ip = clientIp(req);
    const user = await requireUser(req);
    const tier = user ? "user" : "anon";

    // Anti-abuse: anonymous creation is capped per IP (accounts are tracked
    // and get wider limits).
    if (!user && !rateLimit(`push:${ip}`, 10, 60 * 60_000)) {
      return apiError(t("pushAnonLimit"), 429);
    }
    // Wide per-account limit (also covers API tokens): a free account must
    // not be able to flood the database.
    if (user && !rateLimit(`push:user:${user.id}`, 120, 60 * 60_000)) {
      return apiError(t("pushUserLimit"), 429);
    }

    const body = createSchema.parse(await req.json());
    const lim = pushLimits(tier, body.kind);
    const anon = String(!user); // drives the "no account" suffix of messages

    // minutes = canonical source; days (API backward-compat) are converted
    const minutes =
      body.expireAfterMinutes ??
      (body.expireAfterDays != null ? body.expireAfterDays * 1440 : null);
    if (minutes == null) return apiError(t("expireRequired"), 400);

    if (minutes > lim.maxDays * 1440) {
      return apiError(t("maxDays", { days: lim.maxDays, anon }), 400);
    }
    if (body.expireAfterViews > lim.maxViews) {
      return apiError(t("maxViews", { views: lim.maxViews, anon }), 400);
    }

    const ciphertext = Buffer.from(body.ciphertext, "base64");
    if (ciphertext.length > config.maxTextSizeKb * 1024) {
      return apiError(t("payloadTooBig", { kb: config.maxTextSizeKb }), 413);
    }

    let fileSize: number | null = null;
    if (body.kind === "FILE") {
      if (!body.blobPath) return apiError(t("blobRequired"), 400);
      const taken = await prisma.push.findFirst({
        where: { blobPath: body.blobPath },
      });
      if (taken) return apiError(t("blobTaken"), 409);
      try {
        fileSize = await blobSize(body.blobPath);
      } catch {
        return apiError(t("blobMissing"), 400);
      }
      // 2 MiB margin for the encryption overhead (IV + tags per chunk)
      if (fileSize > lim.maxFileMb * 1024 * 1024 + 2 * 1024 * 1024) {
        return apiError(t("fileTooBigMax", { mb: lim.maxFileMb, anon }), 413);
      }
    } else if (body.blobPath) {
      return apiError(t("blobOnlyFiles"), 400);
    }

    const push = await prisma.push.create({
      data: {
        slug: randomToken(22),
        kind: body.kind,
        userId: user?.id ?? null,
        ciphertext,
        blobPath: body.kind === "FILE" ? body.blobPath : null,
        fileSize,
        passphraseHash: body.passphrase
          ? await hashPassword(body.passphrase)
          : null,
        expireAfterMinutes: minutes,
        expireAfterViews: body.expireAfterViews,
        retrievalStep: body.retrievalStep,
        deletableByViewer: body.deletableByViewer,
        note: user ? body.note?.trim() || null : null, // no anonymous history → note useless
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });

    await audit(push.id, "CREATED", {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return json(ownerPushView(push), 201);
  } catch (err) {
    return handleError(err, req);
  }
}

export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await requireUser(req);
    if (!user) return apiError(t("authRequired"), 401);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const perPage = 20;
    const filter = url.searchParams.get("filter"); // active | expired | null (none)

    const where = {
      userId: user.id,
      ...(filter === "active"
        ? { payloadDeleted: false, expiresAt: { gt: new Date() } }
        : filter === "expired"
          ? { OR: [{ payloadDeleted: true }, { expiresAt: { lte: new Date() } }] }
          : {}),
    };

    const [total, pushes] = await Promise.all([
      prisma.push.count({ where }),
      prisma.push.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return json({
      total,
      page,
      perPage,
      pushes: pushes.map(ownerPushView),
    });
  } catch (err) {
    return handleError(err, req);
  }
}
