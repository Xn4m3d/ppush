import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  EyeOff,
  Timer,
  FileQuestion,
  Server,
  UserCog,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { config } from "@/lib/config";
import { Section, Faq } from "./blocks";
import { FlagFr } from "@/components/flag-fr";

/** English content of the About page. Mirror: content.fr.tsx. */
export function AboutContentEn({ showRegister }: { showRegister: boolean }) {
  return (
    <>
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">About</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-dim">
            ppush is a secure secret-sharing service operated by{" "}
            <strong className="text-ink">Alexandre</strong>{" "}
            <FlagFr className="inline h-3 w-auto rounded-[2px] align-baseline" />. It replaces sending
            passwords over email or messaging apps with encrypted,
            limited-use, self-destructing links. Delivered via{" "}
            <strong className="text-ink">Cloudflare</strong>, data{" "}
            <strong className="text-ink">hosted in France</strong>{" "}
            <FlagFr className="inline h-3 w-auto rounded-[2px] align-baseline" />.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-2 text-xs">
          {[
            ["#fonctionnement", "How it works"],
            ["#donnees", "Your data"],
            ["#faq", "FAQ"],
            ["#technique", "Technical"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-line px-3.5 py-1.5 text-ink-dim transition-colors hover:border-accent/40 hover:text-accent-soft"
            >
              {label}
            </a>
          ))}
          <Link
            href="/docs/api"
            className="rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-accent-soft transition-colors hover:bg-accent/20"
          >
            API documentation →
          </Link>
          <Link
            href="/legal"
            className="rounded-full border border-line px-3.5 py-1.5 text-ink-dim transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            Legal notice
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-line px-3.5 py-1.5 text-ink-dim transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            Privacy
          </Link>
        </nav>
      </div>

      <div className="mt-14 space-y-12">
        <Section id="fonctionnement" icon={EyeOff} title="Zero-knowledge: the server cannot read your secrets">
          <p>
            When you create a push, your browser generates a random encryption
            key and encrypts the secret <em>locally</em> (AES-256-GCM). Only
            the encrypted version is sent to the server. The key lives in the
            part of the link after the{" "}
            <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs text-accent-soft">#</code>{" "}
            — a part that browsers <strong className="text-ink">never send</strong> to
            the server.
          </p>
          <p>
            Concretely: even full access to the server or its database cannot
            reveal a single secret. Only people holding the complete link can
            decrypt — that is mathematics, not a promise.
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-ok/25 bg-ok/5 px-4 py-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
            <span>
              Every secret expires automatically after a number of views or a
              delay you choose. On expiry, the encrypted content is{" "}
              <strong className="text-ink">permanently erased</strong> from the server.
            </span>
          </p>
        </Section>

        <Section id="donnees" icon={UserCog} title="Your data, your control">
          <p>
            From{" "}
            <Link href="/account" className="text-accent-soft hover:underline">
              My account
            </Link>
            , you can change your preferences, password, passkeys and two-factor
            authentication <strong className="text-ink">freely</strong> at any
            time.
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              You can <strong className="text-ink">delete your account and all its
              content</strong> (pushes, sessions, passkeys, tokens){" "}
              <strong className="text-ink">immediately and permanently</strong>,
              with no delay and no intervention from us — then{" "}
              <strong className="text-ink">create a fresh account</strong>. The only
              exception, <strong className="text-ink">required by law</strong>: a{" "}
              <strong className="text-ink">minimal connection log (IP address +
              timestamp), severed from your identity</strong>, is kept for as long
              as the host’s legal obligation requires (~12 months), then purged — it
              holds neither your secrets nor your profile.
            </span>
          </p>
          <p>
            ppush is fully <strong className="text-ink">GDPR-</strong> and{" "}
            <strong className="text-ink">LCEN-compliant</strong>: data processed,
            legal bases, retention periods, rights and contact are detailed in
            the{" "}
            <Link href="/legal" className="text-accent-soft hover:underline">
              Legal notice
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" className="text-accent-soft hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        </Section>

        <Section id="faq" icon={FileQuestion} title="Frequently asked questions">
          <Faq q="How do I share a password properly?">
            <p>
              Create the push, copy the link, send it to the recipient. For a
              sensitive secret: limit it to <strong>1 view</strong>, add a{" "}
              <strong>passphrase</strong> and share it over a <em>different</em> channel
              (phone, in person). That way, even if the link is intercepted,
              the secret stays protected.
            </p>
          </Faq>
          <Faq q="I lost the link, can you recover it?">
            <p>
              No — by design. The decryption key only exists in the link:
              neither the server nor the administrators know it. Simply create
              a new push.
            </p>
          </Faq>
          <Faq q="The recipient saw “this secret has expired”, why?">
            <p>
              The push reached its view limit or its expiry date, or it was
              destroyed (by you or by the recipient). Check the audit log in
              your <Link href="/pushes" className="text-accent-soft hover:underline">history</Link>:
              every view is traced with date and IP address. If a view was
              consumed by a stranger, the link leaked in transit — create a
              new push with a passphrase.
            </p>
          </Faq>
          <Faq q="What kinds of content can I push?">
            <p>
              Passwords, free text (configurations, SSH keys, notes), files
              (up to {config.limits.anon.maxFileMb} MB without an account,{" "}
              {config.limits.user.maxFileMb} MB with one — encrypted in your
              browser before upload) and secret URLs (the recipient is
              redirected after decryption).
            </p>
          </Faq>
          <Faq q="How much space for files?">
            <p>
              The service&apos;s file space is shared fairly (fair use): the
              upload area always shows the space actually available, and each
              account gets {config.userStorageQuotaGb} GB of simultaneous
              active files. Space frees up automatically as files expire — if
              the service is full, the error message tells you how much space
              will be freed and when (at the latest), so you can retry at the
              right time. You can also expire your own file pushes from your{" "}
              <Link href="/pushes" className="text-accent-soft hover:underline">
                history
              </Link>{" "}
              to reclaim quota immediately.
            </p>
          </Faq>
          <Faq q="Do I need an account to share a secret?">
            <p>
              No: sharing is open to everyone, no sign-up required. Without an
              account, links are limited to {config.limits.anon.maxDays} days
              and {config.limits.anon.maxViews} views, files to{" "}
              {config.limits.anon.maxFileMb} MB, and you have no history. A{" "}
              <strong className="text-ink">free account</strong> unlocks the
              history of your links, view tracking (who opened the secret,
              when), files up to {config.limits.user.maxFileMb} MB and longer
              retention ({config.limits.user.maxDays} days /{" "}
              {config.limits.user.maxViews} views).
            </p>
          </Faq>
          <Faq q="Who can create an account?">
            <p>
              Anyone: registration is open and free — an email address and a{" "}
              <strong>passkey</strong> (or a 12-character-minimum password) are all
              you need. Viewing a received secret requires no account at all.
            </p>
          </Faq>
          <Faq q="Can I sign in without a password (passkey)?">
            <p>
              Yes — and it&apos;s recommended. When signing up, choose{" "}
              <strong>“Sign up with a passkey”</strong>: your device (Face ID,
              fingerprint, Windows Hello, security key) creates a cryptographic
              key, and you then sign in with a single gesture, no password —
              faster and <strong>phishing-resistant</strong>. You can register
              several passkeys and, if you wish, also set a password and
              two-factor authentication (TOTP) from{" "}
              <Link href="/account" className="text-accent-soft hover:underline">My account</Link>.
            </p>
          </Faq>
          <Faq q="What if I lose my 2FA app?">
            <p>
              Contact{" "}
              <a href="mailto:contact@ppush.online" className="text-accent-soft hover:underline">
                contact@ppush.online
              </a>
              : an administrator can reset your two-factor authentication
              after verification.
            </p>
          </Faq>
          <Faq q="Can the service stop, or a link disappear?">
            <p>
              Yes — and it&apos;s worth knowing. ppush is a{" "}
              <strong>personal, self-funded project</strong>, provided “as is”,
              with no guarantee of availability or continuity. The service may be
              interrupted, slowed down or{" "}
              <strong>permanently shut down at any time</strong>; a link or a
              secret may disappear following a bug, maintenance, an anti-abuse
              purge or a deliberate deletion. It runs as long as I can maintain
              it, technically and financially.
            </p>
            <p>
              So <strong>never</strong> use ppush as a storage or backup means:
              always keep a copy of your important information elsewhere. The
              publisher cannot be held liable for any data loss or
              unavailability.
            </p>
          </Faq>
        </Section>

        <Section id="technique" icon={Server} title="Technical details">
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              Encryption: AES-256-GCM via WebCrypto, key generated client-side,
              never transmitted (URL fragment). Files encrypted in 8 MiB
              chunks with reordering protection.
            </li>
            <li>
              Accounts: passwords hashed with Argon2id, TOTP two-factor
              authentication, opaque sessions hashed in the database.
            </li>
            <li>
              Hosting: data hosted <strong className="text-ink">in France</strong>{" "}
              on self-managed, isolated infrastructure. Delivery and network
              protection (anti-DDoS) go through <strong className="text-ink">Cloudflare</strong>,
              which <strong className="text-ink">never</strong> sees the content of
              your secrets — end-to-end encrypted, key never transmitted.
              Cloudflare is only an encrypted network relay: your data stays in
              France.
            </li>
            <li>
              Per-push audit log: creations, views, wrong passphrase attempts,
              expirations.
            </li>
            <li>
              File storage: dedicated volume, fair-use transparency through
              the public{" "}
              <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs">/api/storage</code>{" "}
              API (available space + upcoming releases), quota of{" "}
              {config.userStorageQuotaGb} GB of active files per account.
            </li>
            <li>
              REST API with personal tokens — see the{" "}
              <Link href="/docs/api" className="text-accent-soft hover:underline">
                API documentation
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section id="cta" icon={Timer} title="Ready to share a secret?">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_20px_-4px_var(--accent-glow)] transition-all hover:bg-accent-soft"
            >
              <Lock className="size-4" />
              Create a push
            </Link>
            {showRegister && (
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent-soft transition-all hover:border-accent/60 hover:bg-accent/20"
              >
                <UserPlus className="size-4" />
                Create my account
              </Link>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
