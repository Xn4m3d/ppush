import { config } from "./config";

/**
 * Operational alert: always in the logs, and as an ntfy notification
 * when ALERT_NTFY_URL is set. The same alert (`key`) is only sent once
 * per half hour, so the phone isn't flooded during an attack.
 * Titles and messages in ASCII English: HTTP headers accept nothing else.
 */
const last = new Map<string, number>();
const QUIET_MS = 30 * 60_000;

export function alert(key: string, title: string, message: string): void {
  console.warn(`[guard] ${title}: ${message}`);
  const now = Date.now();
  if ((last.get(key) ?? 0) > now - QUIET_MS) return;
  last.set(key, now);
  const url = config.guard.alertNtfyUrl;
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { Title: `ppush: ${title}`, Priority: "high", Tags: "warning" },
    body: message,
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}
