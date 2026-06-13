import Link from "next/link";
import { Scale } from "lucide-react";
import { legal } from "@/lib/legal";
import { LegalHeader, LegalSection } from "@/components/legal-blocks";

/** Legal notice & ToS — French. Mirror: content.en.tsx. */
export function LegalContentFr() {
  return (
    <>
      <LegalHeader
        icon={Scale}
        title="Mentions légales"
        updated={`Dernière mise à jour : ${legal.updatedFr}`}
      />

      <LegalSection id="editeur" title="Éditeur du site">
        <p>
          Le service <strong className="text-ink">ppush</strong>{" "}
          (<code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs">https://ppush.online</code>)
          est édité par <strong className="text-ink">{legal.editorName}</strong>,
          particulier, domicilié à {legal.editorCity} ({legal.editorCountry}).
        </p>
        <p>
          Directeur de la publication : {legal.editorName}. Contact :{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="hebergement" title="Hébergement">
        <p>
          Le service est <strong className="text-ink">auto-hébergé</strong> par
          l’éditeur, sur une infrastructure située en {legal.editorCountry}. La
          diffusion, la mise en cache et la protection réseau sont assurées par{" "}
          <strong className="text-ink">{legal.cdn}</strong>, en qualité
          d’intermédiaire technique (réseau de diffusion / tunnel). Par
          conception, aucun contenu en clair n’y transite : le chiffrement est de
          bout en bout (voir la{" "}
          <Link href="/privacy" className="text-accent-soft hover:underline">
            politique de confidentialité
          </Link>
          ).
        </p>
        <p>
          Pour toute question relative à l’hébergement ou pour un signalement de
          contenu :{" "}
          <a href={`mailto:${legal.contactEmail}`} className="text-accent-soft hover:underline">
            {legal.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="propriete" title="Propriété intellectuelle">
        <p>
          La présentation, les textes et le code du site sont la propriété de
          l’éditeur, sauf mentions contraires. Les contenus partagés par les
          utilisateurs restent leur propriété et leur entière responsabilité ;
          l’éditeur n’y a pas accès (chiffrement de bout en bout).
        </p>
      </LegalSection>

      <LegalSection id="cgu" title="Conditions d’utilisation">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            Tout usage à des fins illicites (diffusion de contenus illégaux,
            hameçonnage, atteinte à des tiers) est interdit et entraîne la purge
            des contenus concernés et la désactivation du compte.
          </li>
          <li>
            Chaque utilisateur est responsable des contenus qu’il pousse et de la
            transmission des liens qu’il génère.
          </li>
          <li>
            <strong className="text-ink">Suppression de compte</strong> : vous
            pouvez supprimer votre compte à tout moment. Le compte, le profil et le
            contenu sont effacés immédiatement et définitivement ; seul un{" "}
            <strong className="text-ink">journal de connexion minimal (adresse IP +
            horodatage), dissocié de votre identité</strong>, est conservé{" "}
            <strong className="text-ink">12 mois</strong> — non par choix mais parce
            que la <strong className="text-ink">loi l’impose à tout hébergeur</strong>{" "}
            (LCEN art. 6), conservation que le RGPD soustrait au droit à l’effacement
            (art. 17-3-b) — puis purgé. Détails dans la{" "}
            <a href="/privacy" className="text-accent-soft hover:underline">
              politique de confidentialité
            </a>
            .
          </li>
          <li>
            Le service est fourni « en l’état », sans garantie de disponibilité.
            Par conception, un secret expiré ou un lien perdu sont{" "}
            <em>irrécupérables</em> : ppush n’est pas un outil de stockage ni de
            sauvegarde.
          </li>
          <li>
            ppush est un <strong className="text-ink">projet personnel et
            auto-financé</strong>. Le service peut être suspendu, dégradé ou{" "}
            <strong className="text-ink">définitivement arrêté à tout moment</strong>,
            sans préavis ; un lien ou un secret peut disparaître à la suite d’un
            bug, d’une maintenance, d’une purge anti-abus ou d’une suppression
            volontaire. L’éditeur ne saurait être tenu responsable d’une perte de
            données, d’une indisponibilité ou de l’interruption du service.
          </li>
          <li>
            L’éditeur se réserve le droit de désactiver un compte ou de purger un
            push en cas d’abus, sans pouvoir consulter son contenu.
          </li>
          <li>
            Signalement de vulnérabilité : voir{" "}
            <a href="/.well-known/security.txt" className="text-accent-soft hover:underline">
              security.txt
            </a>
            . Les signalements de bonne foi sont les bienvenus et ne feront
            l’objet d’aucune poursuite.
          </li>
        </ul>
      </LegalSection>

      <p className="text-sm text-ink-faint">
        Voir aussi la{" "}
        <Link href="/privacy" className="text-accent-soft hover:underline">
          politique de confidentialité
        </Link>{" "}
        et la page{" "}
        <Link href="/about" className="text-accent-soft hover:underline">
          À propos
        </Link>
        .
      </p>
    </>
  );
}
