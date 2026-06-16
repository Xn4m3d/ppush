import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { json, apiError, badOrigin, handleError } from "@/lib/api";
import { apiT } from "@/lib/i18n-api";
import { clientIp } from "@/lib/ratelimit";
import { adminLog } from "@/lib/admin-audit";

const PER_PAGE = 20;

/** List of access-recovery requests (filter by status). */
export async function GET(req: Request) {
  const t = await apiT(req);
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const status = url.searchParams.get("status"); // pending | handled | rejected
    const where =
      status === "handled"
        ? { status: "HANDLED" }
        : status === "rejected"
          ? { status: "REJECTED" }
          : status === "pending"
            ? { status: "PENDING" }
            : {};

    const [total, pending, rows] = await Promise.all([
      prisma.recoveryRequest.count({ where }),
      prisma.recoveryRequest.count({ where: { status: "PENDING" } }),
      prisma.recoveryRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
    ]);

    // For each request, flag whether an account uses that email (without
    // disclosing more) → helps the admin know if there's an account to recover.
    const emails = [...new Set(rows.map((r) => r.email))];
    const accounts = emails.length
      ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
      : [];
    const byEmail = new Map(accounts.map((a) => [a.email, a.id]));

    const requests = rows.map((r) => ({
      id: r.id,
      email: r.email,
      message: r.message,
      contact: r.contact,
      status: r.status,
      ip: r.ip,
      userAgent: r.userAgent,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      handledAt: r.handledAt,
      handledBy: r.handledBy,
      accountId: byEmail.get(r.email) ?? null,
    }));

    return json({ requests, total, pending, page, perPage: PER_PAGE });
  } catch (err) {
    return handleError(err, req);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["HANDLED", "REJECTED", "PENDING"]),
  adminNote: z.string().trim().max(2000).optional(),
});

/** Handle a request: status + note. Logged. */
export async function PATCH(req: Request) {
  const t = await apiT(req);
  try {
    if (badOrigin(req)) return apiError(t("badOrigin"), 403);
    const actor = await currentUser();
    if (!actor || actor.role !== "ADMIN") return apiError(t("accessDenied"), 403);

    const { id, status, adminNote } = patchSchema.parse(await req.json());
    const reqRow = await prisma.recoveryRequest.findUnique({ where: { id } });
    if (!reqRow) return apiError(t("recoveryNotFound"), 404);

    await prisma.recoveryRequest.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote ?? reqRow.adminNote,
        handledAt: status === "PENDING" ? null : new Date(),
        handledBy: status === "PENDING" ? null : actor.email,
      },
    });

    if (status !== "PENDING") {
      const account = await prisma.user.findUnique({ where: { email: reqRow.email }, select: { id: true } });
      await adminLog(
        actor,
        status === "HANDLED" ? "RECOVERY_HANDLE" : "RECOVERY_REJECT",
        { type: "USER", id: account?.id ?? null, label: reqRow.email },
        { ip: clientIp(req) }
      );
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err, req);
  }
}
