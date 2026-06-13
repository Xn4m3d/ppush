import { config } from "./config";

/**
 * Verifies a Cloudflare Turnstile token server-side. Returns true when
 * Turnstile is not configured (feature disabled), so the rest of the flow
 * keeps working in dev / before keys are set.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  if (!config.turnstileSecret) return true; // disabled
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: config.turnstileSecret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
