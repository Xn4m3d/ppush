/**
 * Zero-knowledge encryption, run ONLY in the browser.
 *
 * - AES-256 key generated client-side, carried in the URL fragment (#...)
 *   → never sent to the server (fragments never leave the browser).
 * - AES-256-GCM (WebCrypto), random 96-bit IV per encryption.
 * - Small payloads: single blob  [v1][IV(12)][ciphertext+tag].
 * - Files: 8 MiB chunks          [len(4 BE)][IV(12)][ciphertext+tag]…
 *   AAD = "ppush:v1:<index>:<last?1:0>" → prevents reordering and truncation.
 */

export const CHUNK_SIZE = 8 * 1024 * 1024;
const VERSION = 1;

const te = new TextEncoder();
const td = new TextDecoder();

// --- base64url encoding ------------------------------------------------------

export function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- keys --------------------------------------------------------------------

export async function generateKey(): Promise<{ key: CryptoKey; keyB64: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await importKeyRaw(raw);
  return { key, keyB64: toB64Url(raw) };
}

export async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromB64Url(keyB64);
  if (raw.length !== 32) throw new Error("Invalid key");
  return importKeyRaw(raw);
}

async function importKeyRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

// --- simple payloads (password, text, URL, file metadata) --------------------

export type SecretPayload = {
  /** PASSWORD | TEXT | URL | FILE (metadata) */
  t: string;
  /** data: the secret itself, or for FILE { name, type, size } */
  d: string;
  name?: string;
  mime?: string;
  size?: number;
};

export async function encryptPayload(
  key: CryptoKey,
  payload: SecretPayload
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: te.encode("ppush:v1:meta") as BufferSource },
      key,
      te.encode(JSON.stringify(payload)) as BufferSource
    )
  );
  const out = new Uint8Array(1 + 12 + ct.length);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(ct, 13);
  return out;
}

export async function decryptPayload(
  key: CryptoKey,
  blob: Uint8Array
): Promise<SecretPayload> {
  if (blob[0] !== VERSION) throw new Error("Unknown encryption version");
  const iv = blob.slice(1, 13);
  const ct = blob.slice(13);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: te.encode("ppush:v1:meta") as BufferSource },
    key,
    ct as BufferSource
  );
  return JSON.parse(td.decode(pt)) as SecretPayload;
}

// --- files (chunks) -----------------------------------------------------------

function chunkAad(index: number, last: boolean): Uint8Array {
  return te.encode(`ppush:v1:${index}:${last ? 1 : 0}`);
}

/** Encrypts a file into a Blob of framed chunks, ready to upload. */
export async function encryptFile(
  key: CryptoKey,
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const parts: BlobPart[] = [];
  const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  for (let i = 0; i < total; i++) {
    const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const data = new Uint8Array(await slice.arrayBuffer());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv as BufferSource,
          additionalData: chunkAad(i, i === total - 1) as BufferSource,
        },
        key,
        data as BufferSource
      )
    );
    const frame = new Uint8Array(4 + 12 + ct.length);
    new DataView(frame.buffer).setUint32(0, 12 + ct.length, false);
    frame.set(iv, 4);
    frame.set(ct, 16);
    parts.push(frame.buffer as ArrayBuffer);
    onProgress?.(i + 1, total);
  }
  return new Blob(parts, { type: "application/octet-stream" });
}

/** Decrypts a stream of framed chunks. Returns the cleartext Blob. */
export async function decryptFileStream(
  key: CryptoKey,
  stream: ReadableStream<Uint8Array>,
  mime: string,
  onProgress?: (bytes: number) => void
): Promise<Blob> {
  const parts: BlobPart[] = [];
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);
  let index = 0;
  let doneBytes = 0;
  let streamEnded = false;

  const pump = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) {
      streamEnded = true;
      return;
    }
    const merged = new Uint8Array(buffer.length + value.length);
    merged.set(buffer);
    merged.set(value, buffer.length);
    buffer = merged;
  };

  for (;;) {
    // read the frame header
    while (buffer.length < 4 && !streamEnded) await pump();
    if (buffer.length === 0 && streamEnded) break;
    if (buffer.length < 4) throw new Error("Truncated stream");
    const frameLen = new DataView(buffer.buffer, buffer.byteOffset).getUint32(0, false);
    while (buffer.length < 4 + frameLen && !streamEnded) await pump();
    if (buffer.length < 4 + frameLen) throw new Error("Truncated stream");

    const iv = buffer.slice(4, 16);
    const ct = buffer.slice(16, 4 + frameLen);
    buffer = buffer.slice(4 + frameLen);

    // last chunk if nothing remains after it
    while (buffer.length === 0 && !streamEnded) await pump();
    const isLast = streamEnded && buffer.length === 0;

    const pt = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: chunkAad(index, isLast) as BufferSource,
      },
      key,
      ct as BufferSource
    );
    parts.push(pt);
    doneBytes += pt.byteLength;
    onProgress?.(doneBytes);
    index++;
    if (isLast) break;
  }
  return new Blob(parts, { type: mime || "application/octet-stream" });
}

// --- misc ----------------------------------------------------------------------

/** Strong password generator, client-side. */
export type PasswordOptions = {
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  /** Include ambiguous characters (l, I, O, 0, 1) — excluded by default for readability. */
  ambiguous?: boolean;
};

function passwordClasses(opts: PasswordOptions): string[] {
  const {
    lowercase = true,
    uppercase = true,
    digits = true,
    symbols = true,
    ambiguous = false,
  } = opts;
  const classes: string[] = [];
  if (lowercase) classes.push("abcdefghijkmnopqrstuvwxyz" + (ambiguous ? "l" : ""));
  if (uppercase) classes.push("ABCDEFGHJKLMNPQRSTUVWXYZ" + (ambiguous ? "IO" : ""));
  if (digits) classes.push("23456789" + (ambiguous ? "01" : ""));
  if (symbols) classes.push("!@#$%&*+-=?_");
  // never an empty alphabet
  if (classes.length === 0) classes.push("abcdefghijkmnopqrstuvwxyz");
  return classes;
}

/** Effective alphabet size — to display entropy (length × log2(size)). */
export function passwordAlphabetSize(opts: PasswordOptions = {}): number {
  return passwordClasses(opts).join("").length;
}

/** Uniform draw (rejection sampling, CSPRNG) of `count` characters. */
function randomChars(alphabet: string, count: number): string {
  const limit = alphabet.length * Math.floor(256 / alphabet.length);
  let out = "";
  while (out.length < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(count * 2));
    for (let i = 0; i < bytes.length && out.length < count; i++) {
      if (bytes[i] < limit) out += alphabet[bytes[i] % alphabet.length];
    }
  }
  return out;
}

export function generatePassword(length = 20, opts: PasswordOptions = {}): string {
  const classes = passwordClasses(opts);
  const alphabet = classes.join("");
  const len = Math.min(Math.max(Math.trunc(length) || 20, 4), 128);
  // reject draws where an enabled class is missing: uniform over valid
  // passwords, and guarantees e.g. at least one digit/symbol
  for (;;) {
    const pwd = randomChars(alphabet, len);
    if (classes.every((c) => [...pwd].some((ch) => c.includes(ch)))) return pwd;
  }
}
