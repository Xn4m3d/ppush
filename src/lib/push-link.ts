import { generateKey, encryptPayload } from "./crypto";

/** standard base64 (the `/api/pushes` API decodes via Buffer.from(x,"base64")). */
function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * Wraps a URL in a **URL-type** ppush push (E2E-encrypted in the browser) and
 * returns its shareable link (key in the fragment). The recipient gets a
 * clickable "Open" button (no copy-paste). Used on the admin side to deliver a
 * reset link without ever seeing the secret in clear. `retrievalStep` stays on:
 * it protects the single view from a preload (unfurl).
 */
export async function wrapInPush(
  url: string,
  opts?: { minutes?: number; views?: number }
): Promise<string> {
  const { key, keyB64 } = await generateKey();
  const blob = await encryptPayload(key, { t: "URL", d: url });
  const res = await fetch("/api/pushes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "URL",
      ciphertext: toB64(blob),
      expireAfterViews: opts?.views ?? 1,
      expireAfterMinutes: opts?.minutes ?? 60,
      retrievalStep: true,
      deletableByViewer: false,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "push failed");
  }
  const d = await res.json();
  return `${window.location.origin}/p/${d.slug}#${keyB64}`;
}
