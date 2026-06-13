import Link from "next/link";
import { Scale } from "lucide-react";
import { legal } from "@/lib/legal";
import { LegalHeader, LegalSection } from "@/components/legal-blocks";

/** Legal notice & Terms — English. Mirror: content.fr.tsx. */
export function LegalContentEn() {
  return (
    <>
      <LegalHeader
        icon={Scale}
        title="Legal notice"
        updated={`Last updated: ${legal.updatedEn}`}
      />

      <LegalSection id="editeur" title="Site publisher">
        <p>
          The <strong className="text-ink">ppush</strong> service{" "}
          (<code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs">https://ppush.online</code>)
          is published by <strong className="text-ink">{legal.editorName}</strong>,
          a private individual residing in {legal.editorCity} ({legal.editorCountry}).
        </p>
        <p>
          Publication director: {legal.editorName}. Contact:{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="hebergement" title="Hosting">
        <p>
          The service is <strong className="text-ink">self-hosted</strong> by the
          publisher on infrastructure located in {legal.editorCountry}. Delivery,
          caching and network protection are provided by{" "}
          <strong className="text-ink">{legal.cdn}</strong>, acting as a technical
          intermediary (content delivery network / tunnel). By design, no
          cleartext content passes through it: encryption is end-to-end (see the{" "}
          <Link href="/privacy" className="text-accent-soft hover:underline">
            privacy policy
          </Link>
          ).
        </p>
        <p>
          For any hosting question or content report:{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="propriete" title="Intellectual property">
        <p>
          The layout, text and code of the site are the property of the
          publisher, unless stated otherwise. Content shared by users remains
          their property and their sole responsibility; the publisher has no
          access to it (end-to-end encryption).
        </p>
      </LegalSection>

      <LegalSection id="cgu" title="Terms of use">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            Any use for unlawful purposes (distributing illegal content,
            phishing, harming third parties) is forbidden and leads to the purge
            of the content involved and the deactivation of the account.
          </li>
          <li>
            Each user is responsible for the content they push and for how they
            share the links they generate.
          </li>
          <li>
            <strong className="text-ink">Account deletion</strong>: you can delete
            your account at any time. The account, profile and content are erased
            immediately and permanently; only a{" "}
            <strong className="text-ink">minimal connection log (IP address +
            timestamp), severed from your identity</strong>, is kept for{" "}
            <strong className="text-ink">12 months</strong> — not by choice but
            because the <strong className="text-ink">law requires it of every
            host</strong> (LCEN art. 6), a retention that the GDPR exempts from the
            right to erasure (art. 17(3)(b)) — then purged. Details in the{" "}
            <a href="/privacy" className="text-accent-soft hover:underline">
              privacy policy
            </a>
            .
          </li>
          <li>
            The service is provided “as is”, with no availability guarantee. By
            design, an expired secret or a lost link is <em>unrecoverable</em>:
            ppush is not a storage or backup tool.
          </li>
          <li>
            ppush is a <strong className="text-ink">personal, self-funded
            project</strong>. The service may be suspended, degraded or{" "}
            <strong className="text-ink">permanently shut down at any time</strong>,
            without notice; a link or a secret may disappear following a bug,
            maintenance, an anti-abuse purge or a deliberate deletion. The
            publisher cannot be held liable for any data loss, unavailability or
            service interruption.
          </li>
          <li>
            The publisher reserves the right to deactivate an account or purge a
            push in case of abuse, without being able to read its content.
          </li>
          <li>
            Vulnerability reports: see{" "}
            <a href="/.well-known/security.txt" className="text-accent-soft hover:underline">
              security.txt
            </a>
            . Good-faith reports are welcome and will not be prosecuted.
          </li>
        </ul>
      </LegalSection>

      <p className="text-sm text-ink-faint">
        See also the{" "}
        <Link href="/privacy" className="text-accent-soft hover:underline">
          privacy policy
        </Link>{" "}
        and the{" "}
        <Link href="/about" className="text-accent-soft hover:underline">
          About
        </Link>{" "}
        page.
      </p>
    </>
  );
}
