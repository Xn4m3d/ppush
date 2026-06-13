import Link from "next/link";
import { Lock, TerminalSquare, AlertTriangle, BookOpenText } from "lucide-react";
import { config } from "@/lib/config";
import { Code, H2, Endpoint } from "./blocks";

/** English content of the API docs. Mirror: content.fr.tsx. */
export function ApiDocsContentEn() {
  const base = config.baseUrl;
  return (
    <>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">API documentation</h1>
        <p className="max-w-xl text-ink-dim">
          Create pushes from scripts — provisioning, onboarding, CI — while
          keeping end-to-end encryption.
        </p>
      </div>

      <div className="mt-12 space-y-10">
        <section className="space-y-4">
          <H2 id="auth">Authentication</H2>
          <p className="text-sm text-ink-dim">
            Generate a personal token in{" "}
            <Link href="/account" className="text-accent-soft hover:underline">
              Account → API tokens
            </Link>{" "}
            (shown only once), then pass it as a header:
          </p>
          <Code copy>{`Authorization: Bearer ppush_xxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/5 px-4 py-3 text-sm text-ink-dim">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <span>
              <strong className="text-ink">The API only accepts already-encrypted content.</strong>{" "}
              The server never encrypts anything itself — that is what
              guarantees zero-knowledge. Use the provided CLI (recommended) or
              implement the format below.
            </span>
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="cli">
            <span className="inline-flex items-center gap-2">
              <TerminalSquare className="size-5 text-accent-soft" />
              The CLI (recommended)
            </span>
          </H2>
          <p className="text-sm text-ink-dim">
            <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs">tools/ppush-cli.mjs</code>{" "}
            (in the repository) encrypts locally then calls the API. Node ≥ 20,
            no dependencies.
          </p>
          <Code copy>{`export PPUSH_URL=${base}
export PPUSH_TOKEN=ppush_xxx

# password, 3 views max, 7 days
ppush-cli.mjs --password "S3cret!" --views 3 --days 7

# text from stdin
cat config.yml | ppush-cli.mjs --text -

# file with passphrase and private note
ppush-cli.mjs --file dump.sql.gz --passphrase "sesame" --note "backup for Bob"

# → prints the full URL, decryption key included in the fragment`}</Code>
          <p className="text-xs text-ink-faint">
            Options: <code>--days N</code> · <code>--views N</code> ·{" "}
            <code>--passphrase X</code> · <code>--note &quot;…&quot;</code> ·{" "}
            <code>--no-retrieval-step</code> · <code>--no-deletable</code>
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="endpoints">Endpoints</H2>

          <Endpoint method="POST" path="/api/pushes" auth="Bearer or session">
            <p>Creates a push. JSON body:</p>
            <Code>{`{
  "kind": "PASSWORD" | "TEXT" | "FILE" | "URL",
  "ciphertext": "<base64>",          // encrypted payload (see format)
  "blobPath": "xxx.bin",             // FILE only (see POST /api/blobs)
  "passphrase": "optional",
  "expireAfterMinutes": 10080,       // 5..${config.limits.user.maxDays * 1440} (min 5; legacy "expireAfterDays" still accepted)
  "expireAfterViews": 5,             // 1..${config.limits.user.maxViews}
  "retrievalStep": true,
  "deletableByViewer": true,
  "note": "optional private reference"
}`}</Code>
            <p>
              Response <code>201</code>: <code>{`{ "slug", "url", "expiresAt", … }`}</code>.
              The link to share is <code>url + &quot;#&quot; + base64url_key</code> —
              only you know the key.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/api/blobs" auth="Bearer or session">
            <p>
              Upload of a file&apos;s encrypted blob (raw body, max ~
              {config.limits.user.maxFileMb} MB with an account). Response:{" "}
              <code>{`{ "blobPath": "xxx.bin", "size": 123 }`}</code> to pass
              next to <code>POST /api/pushes</code>.
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/api/pushes?page=1&filter=active" auth="Bearer or session">
            <p>
              Paginated list of your pushes. <code>filter</code>:{" "}
              <code>active</code> | <code>expired</code> | (omitted = all).
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/api/pushes/:slug" auth="Bearer or session">
            <p>
              Push details + full audit log (<code>events</code>:
              CREATED, VIEW, FAILED_PASSPHRASE, EXPIRED, OWNER_DELETE,
              VIEWER_DELETE, with IP and user-agent).
            </p>
          </Endpoint>

          <Endpoint method="DELETE" path="/api/pushes/:slug" auth="Bearer or session">
            <p>Expires the push immediately (permanent purge of the payload).</p>
          </Endpoint>

          <Endpoint method="GET" path="/api/p/:slug" auth="public">
            <p>
              Public metadata of a push (kind, expired or not, passphrase
              required…). Does not consume a view.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/api/p/:slug/reveal" auth="public">
            <p>
              Reveals the ciphertext and <strong className="text-ink">consumes a view</strong>. Body:{" "}
              <code>{`{ "passphrase": "…" }`}</code> if required. For a FILE,
              also returns a single-use <code>viewToken</code> for{" "}
              <code>GET /api/p/:slug/blob?vt=…</code>.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/api/p/:slug/burn" auth="public">
            <p>Destruction by the recipient (if allowed at creation).</p>
          </Endpoint>

          <Endpoint method="GET" path="/api/storage" auth="public">
            <p>
              Transparent fair use of file storage:{" "}
              <code>{`{ "availableBytes", "upcoming": [{ "bytes", "at" }] }`}</code>{" "}
              — <code>upcoming</code> lists upcoming space releases
              (cumulative, by latest expiry date). When authenticated, adds{" "}
              <code>{`"user": { "usedBytes", "availableBytes", "quotaBytes" }`}</code>{" "}
              (personal active-files quota). An upload refused for lack of
              space returns <code>507</code> with an estimate of the next
              window.
            </p>
          </Endpoint>
        </section>

        <section className="space-y-4">
          <H2 id="crypto">
            <span className="inline-flex items-center gap-2">
              <Lock className="size-5 text-accent-soft" />
              Encryption format (v1)
            </span>
          </H2>
          <p className="text-sm text-ink-dim">
            If you do not use the CLI, produce the ciphertext as follows
            (AES-256-GCM, WebCrypto or equivalent):
          </p>
          <Code>{`Key      : 32 random bytes → base64url → link fragment (#…)
Payload  : JSON { "t": "PASSWORD|TEXT|URL", "d": "<secret>" }
           (FILE: { "t":"FILE", "d":"", "name", "mime", "size" })

ciphertext = 0x01 ‖ IV(12 bytes) ‖ AES-256-GCM(payload, AAD="ppush:v1:meta")
           → base64 in the "ciphertext" field

Files (blob): 8 MiB chunks, each framed:
  [length u32 BE] [IV 12 bytes] [ct+tag]
  AAD of chunk i: "ppush:v1:<i>:<1 if last, else 0>"`}</Code>
        </section>

        <section className="space-y-4">
          <H2 id="errors">Limits & errors</H2>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-ink-dim">
            <li>
              Error responses: <code>{`{ "error": "message" }`}</code> with the
              appropriate HTTP status (<code>400</code> validation,{" "}
              <code>401</code> auth, <code>403</code> forbidden, <code>404</code>{" "}
              not found, <code>409</code> conflict, <code>410</code> expired,{" "}
              <code>413</code> too large, <code>429</code> rate limit).
            </li>
            <li>
              Per-IP rate limiting on sensitive endpoints (login, passphrase,
              reveal). On a <code>429</code>, wait and retry.
            </li>
            <li>
              Encrypted text payload: {config.maxTextSizeKb} KB max · files:{" "}
              {config.limits.user.maxFileMb} MB max (account) · retention:{" "}
              {config.limits.user.maxDays} days / {config.limits.user.maxViews} views max.
              Without an account: {config.limits.anon.maxDays} days /{" "}
              {config.limits.anon.maxViews} views, files {config.limits.anon.maxFileMb} MB.
            </li>
            <li>
              Fair-use file storage: shared global space (see{" "}
              <code>GET /api/storage</code>) + personal quota of{" "}
              {config.userStorageQuotaGb} GB of active files per account.
              When full → <code>507</code> with an estimate of upcoming space
              releases.
            </li>
            <li>
              An API token has the rights of its owner (creation, listing,
              expiration of <em>their</em> pushes). Revocable at any time from
              the account page.
            </li>
          </ul>
        </section>

        <p className="flex items-center justify-center gap-2 pt-4 text-sm text-ink-faint">
          <BookOpenText className="size-4" />
          See also{" "}
          <Link href="/about" className="text-accent-soft hover:underline">
            the About page
          </Link>{" "}
          and{" "}
          <Link href="/account" className="text-accent-soft hover:underline">
            token management
          </Link>
          .
        </p>
      </div>
    </>
  );
}
