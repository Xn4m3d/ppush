#!/usr/bin/env node
/**
 * ppush CLI — creates pushes by encrypting locally (zero-knowledge preserved).
 *
 * Configuration:
 *   PPUSH_URL    instance URL (e.g. https://ppush.online)
 *   PPUSH_TOKEN  API token (account > API Tokens)
 *
 * Examples:
 *   ppush-cli.mjs --password "S3cret!"                  # push a password
 *   ppush-cli.mjs --text "confidential content"         # push some text
 *   echo "secret" | ppush-cli.mjs --text -              # from stdin
 *   ppush-cli.mjs --file ./dump.sql.gz --days 3         # push a file
 *   ppush-cli.mjs --url "https://intranet/doc" --views 1
 *
 * Options: --days N  --views N  --passphrase X  --note "..."  --no-retrieval-step  --no-deletable
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { webcrypto as crypto } from "node:crypto";

const CHUNK_SIZE = 8 * 1024 * 1024;
const te = new TextEncoder();

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function parseArgs(argv) {
  const args = { days: 7, views: 5, retrievalStep: true, deletable: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--password") args.payload = { kind: "PASSWORD", value: argv[++i] };
    else if (a === "--text") args.payload = { kind: "TEXT", value: argv[++i] };
    else if (a === "--url") args.payload = { kind: "URL", value: argv[++i] };
    else if (a === "--file") args.payload = { kind: "FILE", value: argv[++i] };
    else if (a === "--days") args.days = parseInt(argv[++i], 10);
    else if (a === "--views") args.views = parseInt(argv[++i], 10);
    else if (a === "--passphrase") args.passphrase = argv[++i];
    else if (a === "--note") args.note = argv[++i];
    else if (a === "--no-retrieval-step") args.retrievalStep = false;
    else if (a === "--no-deletable") args.deletable = false;
    else if (a === "--help" || a === "-h") args.help = true;
    else {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

async function encryptPayload(key, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: te.encode("ppush:v1:meta") },
      key,
      te.encode(JSON.stringify(payload))
    )
  );
  const out = new Uint8Array(1 + 12 + ct.length);
  out[0] = 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return out;
}

async function encryptFileChunks(key, data) {
  const total = Math.max(1, Math.ceil(data.length / CHUNK_SIZE));
  const frames = [];
  for (let i = 0; i < total; i++) {
    const slice = data.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: te.encode(`ppush:v1:${i}:${i === total - 1 ? 1 : 0}`),
        },
        key,
        slice
      )
    );
    const frame = Buffer.alloc(4 + 12 + ct.length);
    frame.writeUInt32BE(12 + ct.length, 0);
    frame.set(iv, 4);
    frame.set(ct, 16);
    frames.push(frame);
  }
  return Buffer.concat(frames);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.payload) {
    console.log(
      "Usage: ppush-cli.mjs (--password X | --text X | --file PATH | --url X) [--days N] [--views N] [--passphrase X] [--note ...]"
    );
    process.exit(args.help ? 0 : 1);
  }

  const base = (process.env.PPUSH_URL ?? "").replace(/\/$/, "");
  const token = process.env.PPUSH_TOKEN;
  if (!base || !token) {
    console.error("PPUSH_URL and PPUSH_TOKEN must be set.");
    process.exit(1);
  }

  // value from stdin if "-"
  if (args.payload.value === "-" && args.payload.kind !== "FILE") {
    args.payload.value = (await readFile(0, "utf8")).replace(/\n$/, "");
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
  ]);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let ciphertext;
  let blobPath;

  if (args.payload.kind === "FILE") {
    const data = await readFile(args.payload.value);
    const encrypted = await encryptFileChunks(key, data);
    const up = await fetch(`${base}/api/blobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: encrypted,
    });
    const upData = await up.json();
    if (!up.ok) throw new Error(upData.error ?? "Upload failed");
    blobPath = upData.blobPath;
    ciphertext = await encryptPayload(key, {
      t: "FILE",
      d: "",
      name: basename(args.payload.value),
      mime: "application/octet-stream",
      size: data.length,
    });
  } else {
    ciphertext = await encryptPayload(key, {
      t: args.payload.kind,
      d: args.payload.value,
    });
  }

  const res = await fetch(`${base}/api/pushes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: args.payload.kind,
      ciphertext: Buffer.from(ciphertext).toString("base64"),
      blobPath,
      passphrase: args.passphrase,
      expireAfterDays: args.days,
      expireAfterViews: args.views,
      retrievalStep: args.retrievalStep,
      deletableByViewer: args.deletable,
      note: args.note,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

  console.log(`${data.url}#${b64url(rawKey)}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
