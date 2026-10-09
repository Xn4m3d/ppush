import Link from "next/link";
import { MiniCloud } from "@/components/diffusion/mini-cloud";
import { Story, Step, UseCase, Habit, USE_CASE_ICONS, HABIT_ICONS } from "./blocks";

/** Contenu français de « À quoi sert ce site ? ». Miroir : content.en.tsx. */
export function WhyContentFr() {
  return (
    <>
      <header className="text-center">
        <MiniCloud className="mb-2" seed={11} />
        <h1 className="text-4xl font-bold">À quoi sert ce site ?</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-dim">
          À transmettre une information confidentielle (un mot de passe, un code,
          un document) <strong className="text-ink">sans qu’elle reste ensuite</strong>{" "}
          dans vos e-mails ou vos conversations.
        </p>
      </header>

      <div className="mt-14 space-y-14">
        <Story title="Le problème, au quotidien">
          <p>
            Vous envoyez le code du Wi-Fi par SMS, un mot de passe par e-mail,
            un identifiant sur WhatsApp. Le message est parti, et il{" "}
            <strong className="text-ink">reste là, pendant des années</strong> :
            dans l’historique, dans les sauvegardes, sur un téléphone qui peut être
            perdu, dans une boîte mail qui peut être piratée.
          </p>
          <p>
            Le jour où l’un de ces endroits fuit, votre mot de passe fuit avec lui.
          </p>
        </Story>

        <Story title="Ce que fait ppush">
          <p>
            Au lieu d’envoyer le secret lui-même, vous envoyez{" "}
            <strong className="text-ink">un lien qui le montre une seule fois</strong>,
            puis s’efface. Ce qui reste dans la conversation n’est plus qu’un lien
            mort.
          </p>
          <ol className="grid gap-3 pt-2 sm:grid-cols-3">
            <Step n={1} title="Collez">
              Le mot de passe, le texte ou le fichier à transmettre.
            </Step>
            <Step n={2} title="Choisissez">
              Combien de temps le lien reste valable et combien de fois il peut
              être ouvert.
            </Step>
            <Step n={3} title="Envoyez le lien">
              Votre destinataire l’ouvre, lit, et le secret disparaît.
            </Step>
          </ol>
          <p className="text-sm">
            Rien à installer, aucun compte nécessaire, gratuit. Votre destinataire
            n’a besoin que d’un navigateur.
          </p>
        </Story>

        <Story title="Quelques exemples">
          <div className="grid gap-3 sm:grid-cols-2">
            <UseCase icon={USE_CASE_ICONS.wifi} title="Le Wi-Fi pour vos invités">
              Le code part, puis disparaît. Il ne traîne pas dans le groupe de
              discussion de la famille.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.work} title="Un nouveau collègue">
              Ses premiers identifiants, transmis sans laisser de copie dans la
              messagerie de l’entreprise.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.home} title="Une location de vacances">
              Le code de la boîte à clés ou du portail, valable jusqu’à l’arrivée
              des voyageurs.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.family} title="Un proche à dépanner">
              L’accès à un compte partagé, ou le code d’un abonnement, sans le
              recopier en clair dans un SMS.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.file} title="Un document sensible">
              Une pièce d’identité ou un contrat à envoyer à quelqu’un de confiance,
              qui ne restera pas en pièce jointe.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.support} title="Le support informatique">
              Un accès temporaire donné à un prestataire, qui s’éteint de lui-même.
            </UseCase>
          </div>
        </Story>

        <Story title="Les bons réflexes">
          <div className="space-y-3">
            <Habit icon={HABIT_ICONS.once} title="Un seul destinataire, une seule ouverture">
              Par défaut, le lien ne s’ouvre qu’une fois. Si votre destinataire
              trouve un lien déjà utilisé, c’est que quelqu’un d’autre l’a ouvert
              avant lui : changez le mot de passe concerné.
            </Habit>
            <Habit icon={HABIT_ICONS.split} title="Pour le très sensible, deux chemins">
              Ajoutez une passphrase dans les options avancées, et donnez-la par un
              autre moyen (de vive voix, par téléphone). Le lien seul ne suffit
              alors plus.
            </Habit>
            <Habit icon={HABIT_ICONS.short} title="Une durée courte">
              Un lien qui expire dans une heure ne peut pas être retrouvé dans un
              mois.
            </Habit>
          </div>
        </Story>

        <div className="flex flex-col items-center gap-4 border-t border-line/40 pt-10 text-center">
          <Link
            href="/"
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-soft"
          >
            Partager un secret
          </Link>
          <p className="text-sm text-ink-faint">
            Curieux de savoir comment c’est protégé ?{" "}
            <Link href="/about" className="text-accent-soft underline-offset-2 hover:underline">
              Tout est expliqué dans À propos
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
