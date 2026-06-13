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
        updated={`Last updated: ${legal.updatedEn}`}
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
            views) — for security traceability and service operation.
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
          ppush only uses <strong className="text-ink">strictly necessary</strong>{" "}
          cookies: a session cookie (authentication) and a language preference.{" "}
          <strong className="text-ink">No analytics cookies, no advertising
          trackers</strong> — which is why no consent banner is required.
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
