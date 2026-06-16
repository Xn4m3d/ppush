import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { legal } from "@/lib/legal";
import { LegalHeader, LegalSection } from "@/components/legal-blocks";

/** Privacy policy (GDPR) — French. Mirror: content.en.tsx. */
export function PrivacyContentFr() {
  return (
    <>
      <LegalHeader
        icon={ShieldCheck}
        title="Politique de confidentialité"
        updated={`Dernière mise à jour : ${legal.updatedFr}`}
      />

      <LegalSection id="responsable" title="Responsable de traitement">
        <p>
          Le responsable du traitement des données est{" "}
          <strong className="text-ink">{legal.editorName}</strong>, éditeur du
          service, {legal.editorCity} ({legal.editorCountry}). Pour toute demande
          relative à vos données :{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
        <p className="flex items-start gap-2 rounded-xl border border-ok/25 bg-ok/5 px-4 py-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
          <span>
            <strong className="text-ink">Les contenus des secrets ne sont jamais
            accessibles à l’éditeur</strong> : ils sont chiffrés de bout en bout
            dans votre navigateur et effacés à l’expiration. Cette politique ne
            concerne donc que des <em>métadonnées</em>.
          </span>
        </p>
      </LegalSection>

      <LegalSection id="donnees" title="Données traitées & finalités">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            <strong className="text-ink">Titulaires de compte</strong> : adresse
            email, nom, journal de connexions (dates, adresses IP) — pour fournir
            le service de compte et en assurer la sécurité.
          </li>
          <li>
            <strong className="text-ink">Pour chaque push</strong> : métadonnées
            (type, dates, compteur de vues) et journal d’audit (adresses IP et
            navigateurs des consultations) — à des fins de traçabilité de
            sécurité et de fonctionnement du service. L’IP montrée à
            l’<em>expéditeur</em> est{" "}
            <strong className="text-ink">anonymisée</strong> (dernier octet
            retiré) ; l’IP complète n’est accessible qu’à l’administrateur.
          </li>
          <li>
            <strong className="text-ink">Contenus des secrets</strong> : chiffrés
            de bout en bout, jamais accessibles à l’éditeur, définitivement
            effacés à l’expiration.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="bases" title="Bases légales (RGPD, art. 6)">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            Gestion du compte : <strong className="text-ink">exécution du contrat</strong>{" "}
            (art. 6.1.b).
          </li>
          <li>
            Journaux et adresses IP : <strong className="text-ink">intérêt
            légitime</strong> (sécurité, prévention des abus, art. 6.1.f), et{" "}
            <strong className="text-ink">obligation légale</strong> de conservation
            des données de connexion incombant à l’hébergeur.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="durees" title="Durées de conservation">
        <ul className="list-inside list-disc space-y-1.5">
          <li>Journaux de connexion : <strong className="text-ink">12 mois</strong>.</li>
          <li>Adresses IP du journal d’audit : <strong className="text-ink">12 mois</strong>.</li>
          <li>
            Données de compte (email, nom, passkeys, jetons, sessions) :{" "}
            <strong className="text-ink">effacées dès la suppression du compte</strong>.
          </li>
          <li>
            Suppression d’un compte : le compte et tout le contenu sont effacés{" "}
            <strong className="text-ink">immédiatement et définitivement</strong> ;
            seul un <strong className="text-ink">journal de connexion minimal
            (adresse IP + horodatage de création), dissocié de votre identité</strong>{" "}
            est conservé jusqu’à l’échéance légale de 12 mois, puis purgé. Cette
            conservation nous est imposée par l’obligation de conservation de
            l’hébergeur (LCEN) et échappe au droit à l’effacement (RGPD, art. 17-3-b).
          </li>
          <li>
            Contenus chiffrés : effacés <strong className="text-ink">à l’expiration
            du push</strong> (nombre de vues ou délai atteint).
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="destinataires" title="Destinataires & transferts">
        <p>
          Aucune donnée n’est vendue ni partagée à des tiers à des fins
          commerciales. <strong className="text-ink">Aucun transfert hors Union
          européenne</strong> des données de service (infrastructure en France).
          L’intermédiaire technique réseau ({legal.cdn}) ne traite que du trafic
          chiffré et n’a accès à aucun contenu en clair.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          ppush n’utilise que des cookies{" "}
          <strong className="text-ink">strictement nécessaires</strong> : un cookie
          de session (authentification) et une préférence de langue.{" "}
          <strong className="text-ink">Aucun cookie de mesure d’audience, aucun
          traceur publicitaire</strong> — c’est pourquoi aucune bannière de
          consentement n’est nécessaire.
        </p>
      </LegalSection>

      <LegalSection id="droits" title="Vos droits">
        <p>
          Conformément au RGPD, vous disposez des droits d’<strong className="text-ink">accès</strong>,
          de <strong className="text-ink">rectification</strong>, d’<strong className="text-ink">effacement</strong>,
          d’<strong className="text-ink">opposition</strong>, de{" "}
          <strong className="text-ink">limitation</strong> et de{" "}
          <strong className="text-ink">portabilité</strong>. Exercez-les auprès de{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
        <p>
          Vous avez également le droit d’introduire une réclamation auprès de la{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-accent-soft hover:underline">
            CNIL
          </a>{" "}
          (autorité de contrôle française).
        </p>
      </LegalSection>

      <LegalSection id="securite" title="Sécurité">
        <p>
          Chiffrement de bout en bout (AES-256-GCM, clé jamais transmise),
          mots de passe hachés en Argon2id, double authentification TOTP,
          sessions opaques hachées en base. Détails sur la page{" "}
          <Link href="/about#technique" className="text-accent-soft hover:underline">
            À propos
          </Link>
          . Mentions légales :{" "}
          <Link href="/legal" className="text-accent-soft hover:underline">
            /legal
          </Link>
          .
        </p>
      </LegalSection>
    </>
  );
}
