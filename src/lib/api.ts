import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { config } from "./config";
import { apiT } from "./i18n-api";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Anti-CSRF: for mutating requests coming from the browser (session cookie),
 * the Origin must match the instance. API calls via Bearer token (no cookie)
 * are not concerned.
 */
export function badOrigin(req: Request): boolean {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false; // same-origin requests without header (rare) or non-browser
  try {
    const o = new URL(origin);
    const allowed = new URL(config.baseUrl);
    if (o.host === allowed.host) return false;
    // dev tolerance: localhost
    if (process.env.NODE_ENV !== "production" && o.hostname === "localhost") {
      return false;
    }
    const host = req.headers.get("host");
    return o.host !== host;
  } catch {
    return true;
  }
}

export async function handleError(err: unknown, req?: Request): Promise<NextResponse> {
  const t = req ? await apiT(req) : null;
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => i.message).join(" ; ");
    return apiError(msg || (t ? t("invalidData") : "Invalid data"), 400);
  }
  console.error(err);
  return apiError(t ? t("internal") : "Internal error", 500);
}
