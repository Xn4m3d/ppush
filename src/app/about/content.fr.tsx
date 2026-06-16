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

/** French content of the About page. Mirror: content.en.tsx. */
export function AboutContentFr({ showRegister }: { showRegister: boolean }) {
  return (
    <>
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">À propos</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-dim">
            ppush est un service de partage sécurisé de secrets, opéré par{" "}
            <strong className="text-ink">Alexandre</strong>{" "}
            <FlagFr className="inline h-3 w-auto rounded-[2px] align-baseline" />. Il remplace
            l&apos;envoi de mots de passe par email ou messagerie par des liens
            chiffrés à usage limité, qui s&apos;autodétruisent. Diffusé via{" "}
            <strong className="text-ink">Cloudflare</strong>, données{" "}
            <strong className="text-ink">hébergées en France</strong>{" "}
            <FlagFr className="inline h-3 w-auto rounded-[2px] align-baseline" />.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-2 text-xs">
          {[
            ["#fonctionnement", "Fonctionnement"],
            ["#donnees", "Vos données"],
            ["#faq", "FAQ"],
            ["#technique", "Technique"],
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
            Documentation API →
          </Link>
          <Link
            href="/legal"
            className="rounded-full border border-line px-3.5 py-1.5 text-ink-dim transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            Mentions légales
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-line px-3.5 py-1.5 text-ink-dim transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            Confidentialité
          </Link>
        </nav>
      </div>

      <div className="mt-14 space-y-12">
        <Section id="fonctionnement" icon={EyeOff} title="Zéro-knowledge : le serveur ne peut pas lire vos secrets">
          <p>
            Quand vous créez un push, votre navigateur génère une clé de
            chiffrement aléatoire et chiffre le secret <em>localement</em>{" "}
            (AES-256-GCM). Seule la version chiffrée est envoyée au serveur. La
            clé, elle, est placée dans la partie du lien située après le{" "}
            <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs text-accent-soft">#</code>{" "}
            — une partie que les navigateurs <strong className="text-ink">ne transmettent jamais</strong> au
            serveur.
          </p>
          <p>
            Concrètement : même un accès complet au serveur ou à sa base de
            données ne permet de lire aucun secret. Seules les personnes
            possédant le lien complet peuvent déchiffrer — c&apos;est mathématique,
            pas une promesse.
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-ok/25 bg-ok/5 px-4 py-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
            <span>
              Chaque secret expire automatiquement après un nombre de vues ou un
              délai que vous choisissez. À l&apos;expiration, le contenu chiffré est{" "}
              <strong className="text-ink">définitivement effacé</strong> du serveur.
            </span>
          </p>
        </Section>

        <Section id="donnees" icon={UserCog} title="Vos données, votre contrôle">
          <p>
            Depuis{" "}
            <Link href="/account" className="text-accent-soft hover:underline">
              Mon compte
            </Link>
            , vous modifiez <strong className="text-ink">en libre accès</strong> et
            à tout moment vos préférences, votre mot de passe, vos passkeys et
            votre double authentification.
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              Vous pouvez <strong className="text-ink">supprimer votre compte et
              tout son contenu</strong> (pushes, sessions, passkeys, tokens){" "}
              <strong className="text-ink">immédiatement et définitivement</strong>,
              sans délai ni intervention de notre part — puis{" "}
              <strong className="text-ink">recréer un compte à neuf</strong>. Seule
              exception, <strong className="text-ink">imposée par la loi</strong> :
              un <strong className="text-ink">journal de connexion minimal (adresse
              IP + horodatage), dissocié de votre identité</strong>, est conservé le
              temps de l&apos;obligation de l&apos;hébergeur (~12 mois) puis purgé —
              il ne contient ni vos secrets ni votre profil.
            </span>
          </p>
          <p>
            ppush respecte pleinement le <strong className="text-ink">RGPD</strong>{" "}
            et la <strong className="text-ink">LCEN</strong> : données traitées,
            bases légales, durées de conservation, droits et contact sont
            détaillés dans les{" "}
            <Link href="/legal" className="text-accent-soft hover:underline">
              Mentions légales
            </Link>{" "}
            et la{" "}
            <Link href="/privacy" className="text-accent-soft hover:underline">
              Politique de confidentialité
            </Link>
            .
          </p>
        </Section>

        <Section id="faq" icon={FileQuestion} title="Questions fréquentes">
          <Faq q="Comment partager un mot de passe correctement ?">
            <p>
              Créez le push, copiez le lien, transmettez-le au destinataire.
              Pour un secret sensible : limitez à <strong>1 vue</strong>, ajoutez une{" "}
              <strong>passphrase</strong> et communiquez-la par un <em>autre</em> canal
              (téléphone, de vive voix). Ainsi, même si le lien est intercepté,
              le secret reste protégé.
            </p>
          </Faq>
          <Faq q="J'ai perdu le lien, pouvez-vous le retrouver ?">
            <p>
              Non — et c&apos;est voulu. La clé de déchiffrement n&apos;existe que dans le
              lien : ni le serveur ni les administrateurs ne la connaissent.
              Recréez simplement un push.
            </p>
          </Faq>
          <Faq q="Le destinataire a vu « ce secret a expiré », pourquoi ?">
            <p>
              Le push a atteint sa limite de vues ou sa date d&apos;expiration, ou il
              a été détruit (par vous ou par le destinataire). Vérifiez le
              journal d&apos;audit dans votre <Link href="/pushes" className="text-accent-soft hover:underline">historique</Link> :
              chaque consultation y est tracée avec date et adresse IP. Si une
              vue a été consommée par un inconnu, le lien a fuité en route —
              recréez un push avec passphrase.
            </p>
          </Faq>
          <Faq q="Quels types de contenus puis-je pousser ?">
            <p>
              Mots de passe, textes libres (configurations, clés SSH, notes),
              fichiers (jusqu&apos;à {config.limits.anon.maxFileMb} Mo sans compte,{" "}
              {config.limits.user.maxFileMb} Mo avec — chiffrés dans votre
              navigateur avant l&apos;envoi) et URLs secrètes (le destinataire est
              redirigé après déchiffrement).
            </p>
          </Faq>
          <Faq q="Combien d'espace pour les fichiers ?">
            <p>
              L&apos;espace fichiers du service est partagé équitablement
              (fair-use) : la zone d&apos;upload affiche en permanence
              l&apos;espace réellement disponible, et chaque compte dispose de{" "}
              {config.userStorageQuotaGb} Go de fichiers actifs simultanés.
              L&apos;espace se libère automatiquement à l&apos;expiration des
              fichiers — si le service est saturé, le message d&apos;erreur vous
              indique combien d&apos;espace sera libéré et quand (au plus tard),
              pour réessayer au bon moment. Vous pouvez aussi faire expirer vos
              propres pushes fichiers depuis votre{" "}
              <Link href="/pushes" className="text-accent-soft hover:underline">
                historique
              </Link>{" "}
              pour récupérer du quota immédiatement.
            </p>
          </Faq>
          <Faq q="Faut-il un compte pour partager un secret ?">
            <p>
              Non : le partage est ouvert à tous, sans inscription. Sans compte,
              les liens sont limités à {config.limits.anon.maxDays} jours et{" "}
              {config.limits.anon.maxViews} vues, les fichiers à{" "}
              {config.limits.anon.maxFileMb} Mo, et vous n&apos;avez pas d&apos;historique.
              Un <strong className="text-ink">compte gratuit</strong> débloque
              l&apos;historique de vos liens, le suivi des consultations (qui a
              ouvert le secret, quand), des fichiers jusqu&apos;à{" "}
              {config.limits.user.maxFileMb} Mo et des durées plus longues
              ({config.limits.user.maxDays} jours / {config.limits.user.maxViews} vues).
            </p>
          </Faq>
          <Faq q="Qui peut créer un compte ?">
            <p>
              Tout le monde : l&apos;inscription est libre et gratuite — une
              adresse email et une <strong>passkey</strong> (ou un mot de passe
              de 12 caractères min.) suffisent. La consultation d&apos;un secret
              reçu ne nécessite, elle, aucun compte.
            </p>
          </Faq>
          <Faq q="Puis-je me connecter sans mot de passe (passkey) ?">
            <p>
              Oui — c&apos;est même recommandé. À l&apos;inscription, choisissez{" "}
              <strong>« S&apos;inscrire avec une passkey »</strong> : votre appareil
              (Face ID, empreinte, Windows Hello, clé de sécurité) crée une clé
              cryptographique, et vous vous connectez ensuite d&apos;un geste, sans
              mot de passe — plus rapide et <strong>résistant au hameçonnage</strong>.
              Vous pouvez enregistrer plusieurs passkeys et, si vous le souhaitez,
              définir aussi un mot de passe et la double authentification (TOTP)
              depuis <Link href="/account" className="text-accent-soft hover:underline">Mon compte</Link>.
            </p>
          </Faq>
          <Faq q="J'ai oublié mon mot de passe / je n'arrive plus à me connecter. Envoyez-vous un lien par email ?">
            <p>
              <strong>Non — et c&apos;est volontaire.</strong> ppush n&apos;envoie
              jamais d&apos;email de réinitialisation. Votre compte n&apos;est pas
              lié à une boîte mail récupérable, ce qui supprime toute une famille
              d&apos;attaques par prise de contrôle (liens de reset interceptés ou
              hameçonnés). La contrepartie : la récupération n&apos;est pas
              instantanée, elle est <strong>vérifiée par un humain</strong>.
            </p>
            <p>
              Si vous êtes bloqué, ouvrez la{" "}
              <Link href="/recover" className="text-accent-soft hover:underline">
                récupération d&apos;accès
              </Link>{" "}
              et décrivez vos preuves d&apos;identité. Un administrateur les
              vérifie, puis vous transmet un lien de réinitialisation à usage
              unique. Le moyen le plus sûr de ne <strong>jamais</strong> être
              bloqué : ajouter une <strong>passkey</strong> — son détenteur peut
              toujours se reconnecter sans mot de passe.
            </p>
          </Faq>
          <Faq q="Et si la récupération n'aboutit pas ?">
            <p>
              La récupération n&apos;est pas garantie. Si votre identité ne peut
              pas être établie avec assez de certitude, la demande peut être
              refusée — sans que nous en détaillions forcément la raison, car trop
              en dire aiderait un usurpateur.
            </p>
            <p>
              L&apos;enjeu reste volontairement faible : un compte ne contient que
              l&apos;historique de vos liens et vos préférences. Vos secrets sont
              chiffrés de bout en bout et éphémères — rien n&apos;est jamais retenu
              en otage, et aucune donnée n&apos;est verrouillée dans un compte. Au
              pire, vous recréez un compte : vous ne perdez que l&apos;historique et
              les réglages passés. C&apos;est précisément ce qui nous permet de
              rester stricts sur la vérification sans laisser quiconque avec des
              données inaccessibles.
            </p>
          </Faq>
          <Faq q="Et si je perds mon application 2FA ?">
            <p>
              Ouvrez la{" "}
              <Link href="/recover" className="text-accent-soft hover:underline">
                récupération d&apos;accès
              </Link>{" "}
              : un administrateur peut réinitialiser votre double authentification
              après vérification de votre identité. Une passkey enregistrée permet
              aussi de vous connecter sans le code 2FA.
            </p>
          </Faq>
          <Faq q="Le service peut-il s'arrêter, ou un lien disparaître ?">
            <p>
              Oui — et il vaut mieux le savoir. ppush est un{" "}
              <strong>projet personnel et auto-financé</strong>, fourni « en
              l&apos;état », sans garantie de disponibilité ni de continuité. Le
              service peut être interrompu, ralenti ou{" "}
              <strong>définitivement arrêté à tout moment</strong> ; un lien ou un
              secret peut disparaître à la suite d&apos;un bug, d&apos;une opération de
              maintenance, d&apos;une purge anti-abus ou d&apos;une suppression
              volontaire. Il fonctionne tant que je peux le maintenir,
              techniquement et financièrement.
            </p>
            <p>
              N&apos;utilisez donc <strong>jamais</strong> ppush comme moyen de
              stockage ou de sauvegarde : conservez toujours une copie de vos
              informations importantes ailleurs. L&apos;éditeur ne saurait être tenu
              responsable d&apos;une perte de données ou d&apos;une indisponibilité.
            </p>
          </Faq>
        </Section>

        <Section id="technique" icon={Server} title="Détails techniques">
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              Chiffrement : AES-256-GCM via WebCrypto, clé générée côté client,
              jamais transmise (fragment d&apos;URL). Fichiers chiffrés par chunks
              de 8 Mio avec protection contre le réordonnancement.
            </li>
            <li>
              Comptes : mots de passe hachés en Argon2id, double
              authentification TOTP, sessions opaques hachées en base.
            </li>
            <li>
              Hébergement : données hébergées <strong className="text-ink">en
              France</strong> sur infrastructure auto-gérée et isolée. La
              diffusion et la protection réseau (anti-DDoS) passent par{" "}
              <strong className="text-ink">Cloudflare</strong>, qui ne voit{" "}
              <strong className="text-ink">jamais</strong> le contenu de vos
              secrets — chiffrés de bout en bout, clé jamais transmise. Cloudflare
              n&apos;est qu&apos;un relais réseau chiffré : vos données restent en France.
            </li>
            <li>
              Journal d&apos;audit par push : créations, consultations, tentatives
              de passphrase erronées, expirations.
            </li>
            <li>
              Stockage fichiers : volume dédié, transparence fair-use via
              l&apos;API publique{" "}
              <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs">/api/storage</code>{" "}
              (espace disponible + libérations à venir), quota de{" "}
              {config.userStorageQuotaGb} Go de fichiers actifs par compte.
            </li>
            <li>
              API REST avec tokens personnels — voir la{" "}
              <Link href="/docs/api" className="text-accent-soft hover:underline">
                documentation API
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section id="cta" icon={Timer} title="Prêt à partager un secret ?">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_20px_-4px_var(--accent-glow)] transition-all hover:bg-accent-soft"
            >
              <Lock className="size-4" />
              Créer un push
            </Link>
            {showRegister && (
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent-soft transition-all hover:border-accent/60 hover:bg-accent/20"
              >
                <UserPlus className="size-4" />
                Je crée mon compte
              </Link>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
