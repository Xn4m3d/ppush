import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a nonce. Lets us drop 'unsafe-inline'
 * from script-src: without it, an injected tag (XSS) could read the AES key from
 * the URL fragment and exfiltrate it, breaking the zero-knowledge model. Next.js
 * automatically applies the nonce to its own <script> tags by reading it from the
 * request's Content-Security-Policy header.
 */
export function middleware(request: NextRequest) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));

  const csp = [
    "default-src 'self'",
    // challenges.cloudflare.com: Turnstile widget (anti-bot at registration)
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // all pages except static assets and API routes (JSON, no scripts)
    { source: "/((?!api|_next/static|_next/image|favicon.ico).*)" },
  ],
};
