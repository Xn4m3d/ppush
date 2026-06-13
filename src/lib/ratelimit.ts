/**
 * In-memory rate limiting (single instance — no Redis needed).
 * Simple sliding window per key.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref?.();

/**
 * Returns true if the call is allowed, false if the limit is reached.
 * @param key identifier (e.g. `login:1.2.3.4`)
 * @param max max number of calls per window
 * @param windowMs window duration
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= max;
}

export function clientIp(req: Request): string {
  // Behind Cloudflare: header set by the edge = real client IP. RELIABLE only
  // if the origin accepts ONLY Cloudflare IPs (otherwise an attacker hitting
  // the origin directly could forge this header).
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  // Otherwise, behind a reverse proxy: X-Forwarded-For. We take the LAST
  // entry (added by our proxy): the first one is client-controllable if the
  // proxy appends (nginx-style), which would allow bypassing all per-IP
  // limits.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1].trim();
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
