import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { blobDir } from "./config";
import { randomToken } from "./tokens";

export async function ensureBlobDir(): Promise<void> {
  await fsp.mkdir(blobDir(), { recursive: true });
}

/** Absolute path of a blob from its relative name stored in the DB. */
export function blobAbsolutePath(relPath: string): string {
  const abs = path.resolve(blobDir(), relPath);
  // Path-traversal guard
  if (!abs.startsWith(path.resolve(blobDir()) + path.sep)) {
    throw new Error("Invalid blob path");
  }
  return abs;
}

/** Writes a request stream to a new blob. Returns {relPath, size}. */
export async function writeBlob(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<{ relPath: string; size: number }> {
  await ensureBlobDir();
  const relPath = `${randomToken(32)}.bin`;
  const abs = blobAbsolutePath(relPath);
  const out = fs.createWriteStream(abs, { mode: 0o600 });
  let size = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new TooLargeError();
      if (!out.write(value)) {
        await new Promise<void>((res, rej) => {
          out.once("drain", res);
          out.once("error", rej);
        });
      }
    }
    await new Promise<void>((res, rej) => {
      out.end(() => res());
      out.once("error", rej);
    });
    return { relPath, size };
  } catch (err) {
    out.destroy();
    await fsp.unlink(abs).catch(() => {});
    throw err;
  }
}

export async function deleteBlob(relPath: string): Promise<void> {
  await fsp.unlink(blobAbsolutePath(relPath)).catch(() => {});
}

export function blobStream(relPath: string): fs.ReadStream {
  return fs.createReadStream(blobAbsolutePath(relPath));
}

export async function blobSize(relPath: string): Promise<number> {
  const st = await fsp.stat(blobAbsolutePath(relPath));
  return st.size;
}

export class TooLargeError extends Error {
  constructor() {
    super("Payload too large");
  }
}
