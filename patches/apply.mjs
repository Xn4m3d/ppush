/**
 * Local dependency patches, applied at the start of `npm run build` and
 * `npm run dev` (not as `postinstall`: with `ignore-scripts=true` in an
 * .npmrc, npm would not run it and the patch would be missing silently).
 *
 * Each file of `patches/<package>/…` replaces its counterpart in
 * `node_modules/<package>/…`, for ONE exact package version and ONE known
 * original content (SHA-256). Another version, or a different original
 * file: the build fails — a patch is never applied blindly. Already
 * applied: nothing to do.
 *
 * Patches in place:
 * - @zxcvbn-ts/core 4.2.0, dist/utils/levenshtein.{mjs,cjs} — same result,
 *   without listing the whole dictionary at each estimate (see the file's
 *   header). To remove with the update that ships zxcvbn-ts/zxcvbn#351.
 *   (The IIFE bundle `dist/zxcvbn-ts.js` is not patched: ppush doesn't use it.)
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PATCHES = [
  {
    pkg: "@zxcvbn-ts/core",
    version: "4.2.0",
    files: {
      "dist/utils/levenshtein.mjs": "4fde16797deac4c43d708d369834ea4cfdc563f69d1bd2054f2e74a3d727d486",
      "dist/utils/levenshtein.cjs": "cebb2ca5242696bffef56300f2f38c42f0f5496acec4cb59dee6059a80cf1367",
    },
  },
];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const fail = (msg) => {
  console.error(`patches: ${msg}`);
  process.exit(1);
};

for (const { pkg, version, files } of PATCHES) {
  const dir = join(root, "node_modules", pkg);
  const manifest = join(dir, "package.json");
  if (!existsSync(manifest)) fail(`${pkg} missing from node_modules (run npm ci first)`);
  const installed = JSON.parse(readFileSync(manifest, "utf8")).version;
  if (installed !== version) {
    fail(`${pkg} ${installed} installed, patch made for ${version}: review it (or remove it if the update makes it unnecessary)`);
  }
  for (const [file, original] of Object.entries(files)) {
    const target = join(dir, file);
    const patched = readFileSync(join(root, "patches", pkg, file));
    const current = sha256(readFileSync(target));
    if (current === sha256(patched)) continue;
    if (current !== original) fail(`${pkg}/${file} matches neither the expected original nor the patch (hash ${current})`);
    writeFileSync(target, patched);
    console.log(`patches: ${pkg}/${file} patched`);
  }
}
