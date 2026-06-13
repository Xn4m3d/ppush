# ppush — secure secret sharing

Share passwords, text, files and URLs through **encrypted, self-destructing
links**. Live and free at **[ppush.online](https://ppush.online)** — open
registration, no approval required.

Inspired by [Password Pusher](https://pwpush.com), rebuilt from scratch around a
strict **zero-knowledge** design.

> This repository is the source code behind the hosted service, published for
> transparency and auditability. A zero-knowledge tool is only as trustworthy as
> its code is readable.

## Zero-knowledge by design

The server **cannot read** the secrets it stores:

1. The browser generates a random AES-256 key and encrypts the secret locally
   (AES-256-GCM, WebCrypto).
2. Only the **ciphertext** is sent to the server.
3. The key travels in the **URL fragment**
   (`https://ppush.online/p/<slug>#<key>`) — fragments are never transmitted to
   the server by browsers.
4. The recipient decrypts locally. On expiry, the ciphertext is permanently
   purged (only metadata and the audit log remain).

A full database breach reveals **no secret**.

## Features

- **No account required**: open, anonymous sharing, with a deliberately strict
  cap (7 days / 5 views, 10 MB files). A free account unlocks history, view
  tracking, 100 MB files and longer retention (30 days / 50 views).
- **Four push types**: password, text, file (encrypted in 8 MiB chunks), URL
  (redirect after decryption).
- **Expiry** by duration (days) **and** by view count — whichever comes first.
- **Optional passphrase** (Argon2id hash on the server side, rate-limited).
- **"Click to reveal" retrieval step**: automatic link previews (messaging apps,
  antivirus) do not burn a view.
- **Recipient-side destruction** (optional).
- **Per-push audit log**: creations, views, wrong passphrases, expirations
  (IP + user-agent, disableable via `LOG_IPS=false`).
- **Client-side strong password generator** (CSPRNG, rejection sampling), fully
  customizable: length 8–64, character classes (lower / upper / digits /
  symbols), ambiguous characters excluded by default, guaranteed presence of
  each enabled class, entropy displayed in bits.
- **Transparent fair-use file storage**: available space shown live during
  upload, per-account quota, and a clear message on saturation explaining how
  much space will be freed and when (see below).
- **QR code** of the generated link.
- **Private reference notes** (visible only to the creator).
- **Accounts**: public registration (restrictable by email domain + admin
  approval via env), TOTP 2FA, per-user defaults, admin role (the first account
  created is admin), user management.
- **REST API + tokens** and a zero-knowledge **CLI** (`tools/ppush-cli.mjs`).
- **Responsive UI**: fully usable on mobile (no iOS zoom on focus, scrollable
  tables, touch-friendly controls).

## File storage: transparent fair-use

The service is free, so file space is shared fairly:

- Encrypted blobs live on a **dedicated volume** (`data/blobs/`), separable from
  the rest of the data.
- `GET /api/storage` (public) exposes the **actually available space** and
  **upcoming releases** (cumulative, by latest expiry date) — the UI shows this
  in the upload area.
- Two optional application quotas:
  - `STORAGE_QUOTA_GB` — **global** cap on blobs (protects anything sharing the
    disk);
  - `USER_STORAGE_QUOTA_GB` — cap on **active files per account** (default:
    3 GB). An account reclaims quota when its files expire, or immediately by
    expiring them from the history.
- Saturation (global or personal quota) → **HTTP 507** with an explicit message:
  "X will be freed within at most Y (file expiry): retry then". The estimate
  comes from the `expiresAt` of active files; a sweeper purges expired payloads
  and orphan blobs every 10 minutes.

## Security

- Encryption: AES-256-GCM, random 96-bit IV, anti-reordering AAD on file chunks,
  key never sent to the server.
- Passwords / passphrases: **Argon2id** (OWASP 2025: m=19 MiB, t=2, p=1).
- Sessions: opaque 256-bit tokens **hashed at rest** (SHA-256), `httpOnly` +
  `secure` + `SameSite=Lax` cookies.
- Anti-CSRF: `Origin` verification on every mutation.
- Rate limiting (in-memory, per IP and per account): login, registration, 2FA,
  passphrase, reveal, burn, public metadata, password change, push creation and
  uploads — including for authenticated accounts (120 pushes/h, 30 uploads/h).
  The client IP is read from the **last** `X-Forwarded-For` entry (the one set
  by the reverse proxy), not client-spoofable.
- Headers: strict CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` (the key in
  the fragment never leaks via the Referer).
- Slugs and tokens: base58 without ambiguous characters, ≥128 bits of entropy,
  constant-time comparison.
- File downloads: single-use token issued after passphrase check and view
  decrement.

## API

Authentication: `Authorization: Bearer <token>` (account → API Tokens).
**Important**: the API expects **ciphertext** — encrypt client-side to preserve
zero-knowledge. The simplest way is the bundled CLI:

```bash
export PPUSH_URL=https://ppush.online
export PPUSH_TOKEN=ppush_xxx

tools/ppush-cli.mjs --password "S3cret!" --views 3 --days 7
tools/ppush-cli.mjs --text - < notes.txt
tools/ppush-cli.mjs --file dump.sql.gz --passphrase "sesame" --note "backup for Bob"
# → prints the full URL (key included in the fragment)
```

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/pushes` | Create a push (`kind`, `ciphertext` base64, `blobPath?`, `passphrase?`, `expireAfterDays`, `expireAfterViews`, `retrievalStep?`, `deletableByViewer?`, `note?`) |
| `GET` | `/api/pushes?page=&filter=` | List your pushes (`filter=active\|expired`) |
| `GET` | `/api/pushes/:slug` | Detail + audit log |
| `DELETE` | `/api/pushes/:slug` | Expire immediately |
| `POST` | `/api/blobs` | Upload an encrypted blob (raw body) → `{blobPath}`; `507` + estimate if storage/quota full |
| `GET` | `/api/storage` | Available space + upcoming releases; authenticated: + personal quota |
| `GET` | `/api/p/:slug` | Public metadata |
| `POST` | `/api/p/:slug/reveal` | Reveal (`{passphrase?}`) → ciphertext + view decrement |
| `GET` | `/api/p/:slug/blob?vt=` | Download the blob (single-use token) |
| `POST` | `/api/p/:slug/burn` | Recipient-side destruction |

Full documentation at [/docs/api](https://ppush.online/docs/api) (including the
v1 encryption format, to implement a client without the CLI).

## Local development

```bash
npm install
npx prisma migrate dev      # creates data/ppush.db
npm run dev                 # http://localhost:3000
```

The first account created becomes administrator.

### Configuration reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:3000` | Public URL (generated links, anti-CSRF) |
| `DATA_DIR` | `./data` | SQLite + blobs directory |
| `ALLOWED_EMAIL_DOMAINS` | *(empty = all)* | Restrict registration by domain |
| `REQUIRE_APPROVAL` | `false` | New accounts require admin approval |
| `MAX_FILE_SIZE_MB` | `512` | Max file size (account) |
| `ANON_MAX_FILE_MB` | `10` | Max file size (anonymous) |
| `STORAGE_QUOTA_GB` | `0` *(off)* | Global blob cap |
| `USER_STORAGE_QUOTA_GB` | `3` | Max active files per account (0 = off) |
| `MAX_TEXT_SIZE_KB` | `1024` | Max encrypted text payload size |
| `USER_MAX_DAYS` / `USER_MAX_VIEWS` | `30` / `50` | Max retention (account) |
| `USER_MAX_FILE_DAYS` | `30` | Max file retention (account) |
| `ANON_MAX_DAYS` / `ANON_MAX_VIEWS` | `7` / `5` | Max retention (anonymous) |
| `ANON_MAX_FILE_DAYS` | `10` | Max file retention (anonymous) |
| `ANON_DEFAULT_DAYS` / `ANON_DEFAULT_VIEWS` | `2` / `1` | Suggested values (anonymous) |
| `DATA_RETENTION_DAYS` | `365` | Audit-log IP/UA retention before anonymization |
| `SESSION_DAYS` | `14` | Session lifetime |
| `LOG_IPS` | `true` | Store IPs in the audit log |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | *(empty = off)* | Cloudflare Turnstile (anti-bot at registration) |

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 7 + SQLite ·
Argon2id (`@node-rs/argon2`) · WebCrypto · Docker.

## License

[GNU AGPL-3.0](LICENSE). Security disclosure: see [SECURITY.md](SECURITY.md).
