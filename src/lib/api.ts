import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { config } from "./config";
import { apiT } from "./i18n-api";
import type { Gate } from "./guard";

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

/**
 * Response from a global safeguard (see guard.ts). `captcha: true` tells the
 * client to show Turnstile and resend the request with the token.
 */
export async function gateError(gate: Exclude<Gate, "ok">, req: Request): Promise<NextResponse> {
  const t = await apiT(req);
  if (gate === "captcha") return NextResponse.json({ error: t("captchaRequired"), captcha: true }, { status: 428 });
  return apiError(gate === "disk" ? t("serviceFull") : t("serviceBusy"), 503);
}

/** Request body over the allowed size (see readJson). */
export class BodyTooLarge extends Error {}

/**
 * `req.json()` with a ceiling: refuses before reading if Content-Length
 * exceeds it, and stops reading otherwise (chunked body). Without this,
 * a request of several tens of MB would be loaded into memory before
 * any validation applies.
 */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  if (!req.body) throw new SyntaxError("empty body");
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const p of parts) { all.set(p, off); off += p.length; }
  return JSON.parse(new TextDecoder().decode(all));
}

export async function handleError(err: unknown, req?: Request): Promise<NextResponse> {
  const t = req ? await apiT(req) : null;
  if (err instanceof BodyTooLarge) return apiError(t ? t("bodyTooLarge") : "Request too large", 413);
  // unreadable JSON: a client error, not a server one
  if (err instanceof SyntaxError) return apiError(t ? t("invalidData") : "Invalid data", 400);
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => i.message).join(" ; ");
    return apiError(msg || (t ? t("invalidData") : "Invalid data"), 400);
  }
  console.error(err);
  return apiError(t ? t("internal") : "Internal error", 500);
}
