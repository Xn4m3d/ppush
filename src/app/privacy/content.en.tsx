import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { legal } from "@/lib/legal";
import { LegalHeader, LegalSection } from "@/components/legal-blocks";

/** Privacy policy (GDPR) — English. Mirror: content.fr.tsx. */
export function PrivacyContentEn() {
  return (
    <>
      <LegalHeader
        icon={ShieldCheck}
        title="Privacy policy"
        updated={`Last updated: ${legal.privacyUpdatedEn}`}
      />

      <LegalSection id="responsable" title="Data controller">
        <p>
          The data controller is{" "}
          <strong className="text-ink">{legal.editorName}</strong>, publisher of
          the service, {legal.editorCity} ({legal.editorCountry}). For any request
          regarding your data:{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
        <p className="flex items-start gap-2 rounded-xl border border-ok/25 bg-ok/5 px-4 py-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
          <span>
            <strong className="text-ink">The content of secrets is never
            accessible to the publisher</strong>: it is end-to-end encrypted in
            your browser and erased on expiry. This policy therefore only covers{" "}
            <em>metadata</em>.
          </span>
        </p>
      </LegalSection>

      <LegalSection id="donnees" title="Data processed & purposes">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            <strong className="text-ink">Account holders</strong>: email address,
            name, sign-in log (dates, IP addresses) — to provide the account
            service and ensure its security.
          </li>
          <li>
            <strong className="text-ink">For each push</strong>: metadata (type,
            dates, view counter) and audit log (IP addresses and browsers of
            views) — for security traceability and service operation. The IP
            shown to the <em>sender</em> is{" "}
            <strong className="text-ink">anonymized</strong> (last octet removed);
            the full IP is only accessible to the administrator.
          </li>
          <li>
            <strong className="text-ink">Secret content</strong>: end-to-end
            encrypted, never accessible to the publisher, permanently erased on
            expiry.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="bases" title="Legal bases (GDPR, art. 6)">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            Account management: <strong className="text-ink">performance of the contract</strong>{" "}
            (art. 6(1)(b)).
          </li>
          <li>
            Logs and IP addresses: <strong className="text-ink">legitimate
            interest</strong> (security, abuse prevention, art. 6(1)(f)), and a{" "}
            <strong className="text-ink">legal obligation</strong> on the host to
            retain connection data.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="durees" title="Retention periods">
        <ul className="list-inside list-disc space-y-1.5">
          <li>Sign-in logs: <strong className="text-ink">12 months</strong>.</li>
          <li>Audit-log IP addresses: <strong className="text-ink">12 months</strong>.</li>
          <li>
            Account data (email, name, passkeys, tokens, sessions):{" "}
            <strong className="text-ink">erased as soon as the account is deleted</strong>.
          </li>
          <li>
            Deleting an account: the account and all content are erased{" "}
            <strong className="text-ink">immediately and permanently</strong>; only a{" "}
            <strong className="text-ink">minimal connection log (IP address +
            creation timestamp), severed from your identity</strong> is kept until
            the 12-month legal deadline, then purged. This retention is required of
            us as a host and is exempt from the right to erasure (GDPR, art. 17(3)(b)).
          </li>
          <li>
            Encrypted content: erased <strong className="text-ink">on push expiry</strong>{" "}
            (view count or delay reached).
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="destinataires" title="Recipients & transfers">
        <p>
          No data is sold or shared with third parties for commercial purposes.{" "}
          <strong className="text-ink">No transfer outside the European Union</strong>{" "}
          of service data (infrastructure in France). The technical network
          intermediary ({legal.cdn}) only handles encrypted traffic and has no
          access to any cleartext content.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          ppush sets <strong className="text-ink">no analytics cookies, no
          advertising trackers and no social media trackers</strong>. On your
          first visit, ppush itself writes nothing to your device; only
          Cloudflare security cookies may be set right away. Here is the full
          list:
        </p>
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            <code className="font-mono text-xs text-ink">ppush_session</code> (cookie):
            keeps you signed in to your account. Set when you sign in, removed
            when you sign out or after 14 days at most.
          </li>
          <li>
            <code className="font-mono text-xs text-ink">lang</code> and{" "}
            <code className="font-mono text-xs text-ink">theme</code> (cookies): the
            language and theme you picked in the footer. Kept for 12 months.
          </li>
          <li>
            <code className="font-mono text-xs text-ink">ppush-gen</code> (browser
            local storage): your password generator settings, saved when you
            change them. Never sent to the server; you can erase it by clearing
            the site&apos;s browsing data.
          </li>
          <li>
            Cloudflare security cookies (for example{" "}
            <code className="font-mono text-xs text-ink">__cf_bm</code>): set by our
            network provider to tell visitors from bots and protect the service
            from abuse. They are not used to follow you across sites.
          </li>
        </ul>
        <p>
          These are either <strong className="text-ink">strictly necessary</strong>{" "}
          for the service (session, security) or tied to a{" "}
          <strong className="text-ink">customization you asked for</strong>{" "}
          (language, theme, generator). They are therefore exempt from consent
          under the EU ePrivacy rules (in France, article 82 of the Data Protection
          Act and the CNIL guidelines), which is why no banner is shown.
        </p>
      </LegalSection>

      <LegalSection id="droits" title="Your rights">
        <p>
          Under the GDPR, you have the rights of <strong className="text-ink">access</strong>,{" "}
          <strong className="text-ink">rectification</strong>,{" "}
          <strong className="text-ink">erasure</strong>,{" "}
          <strong className="text-ink">objection</strong>,{" "}
          <strong className="text-ink">restriction</strong> and{" "}
          <strong className="text-ink">portability</strong>. Exercise them at{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
        <p>
          You also have the right to lodge a complaint with the{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-accent-soft hover:underline">
            CNIL
          </a>{" "}
          (the French supervisory authority).
        </p>
      </LegalSection>

      <LegalSection id="securite" title="Security">
        <p>
          End-to-end encryption (AES-256-GCM, key never transmitted), passwords
          hashed with Argon2id, TOTP two-factor authentication, opaque sessions
          hashed in the database. Details on the{" "}
          <Link href="/about#technique" className="text-accent-soft hover:underline">
            About
          </Link>{" "}
          page. Legal notice:{" "}
          <Link href="/legal" className="text-accent-soft hover:underline">
            /legal
          </Link>
          .
        </p>
      </LegalSection>
    </>
  );
}
